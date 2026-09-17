"""«Мій Гараж» на сервері: авто покупця їде за акаунтом, а не за браузером.

Раніше гараж зберігався тільки в localStorage, тож на іншому пристрої (або
після чистки браузера) людина бачила порожній гараж, хоча була залогінена.
Тут ті самі авто лежать у БД і прив'язані до `customer.id`, а клієнт тримає
localStorage як швидкий кеш і як режим для незалогінених.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from dependencies import get_current_customer
from models import Customer, GarageCar
from schemas import GarageCarCreate, GarageCarRead, GarageCarUpdate, GarageImportRequest

router = APIRouter(prefix="/garage", tags=["garage"])


def _read(car: GarageCar) -> GarageCarRead:
    return GarageCarRead(
        id=car.id,
        vin=car.vin,
        plate=car.plate,
        model=car.model,
        generation=car.generation,
        year=car.year,
        drive=car.drive,
        plant=car.plant,
        body_type=car.body_type,
        description=car.description,
        is_active=car.is_active,
        created_at=car.created_at,
    )


def _customer_cars(session: Session, customer_id: int) -> List[GarageCar]:
    return list(
        session.exec(
            select(GarageCar)
            .where(GarageCar.customer_id == customer_id)
            .order_by(GarageCar.is_active.desc(), GarageCar.id)
        ).all()
    )


def _activate(session: Session, customer_id: int, car_id: int) -> None:
    """Активним може бути рівно одне авто — інакше підбір у магазині двозначний."""
    for car in _customer_cars(session, customer_id):
        car.is_active = car.id == car_id
        session.add(car)
    session.commit()


@router.get("", response_model=List[GarageCarRead])
def list_garage_cars(
    customer: Customer = Depends(get_current_customer),
    session: Session = Depends(get_session),
):
    return [_read(car) for car in _customer_cars(session, customer.id)]


@router.post("", response_model=GarageCarRead, status_code=201)
def add_garage_car(
    payload: GarageCarCreate,
    customer: Customer = Depends(get_current_customer),
    session: Session = Depends(get_session),
):
    cars = _customer_cars(session, customer.id)

    # Те саме авто вдруге не додаємо: VIN — найточніший ключ, без VIN —
    # модель разом із поколінням.
    existing: Optional[GarageCar] = None
    for car in cars:
        same_vin = payload.vin and car.vin and car.vin.upper() == payload.vin.upper()
        same_model = (
            not payload.vin
            and not car.vin
            and car.model == payload.model
            and (car.generation or "") == (payload.generation or "")
        )
        if same_vin or same_model:
            existing = car
            break

    if existing:
        existing.plate = payload.plate or existing.plate
        existing.model = payload.model or existing.model
        existing.generation = payload.generation or existing.generation
        existing.year = payload.year or existing.year
        existing.drive = payload.drive or existing.drive
        existing.description = payload.description or existing.description
        session.add(existing)
        session.commit()
        session.refresh(existing)
        if payload.make_active:
            _activate(session, customer.id, existing.id)
            session.refresh(existing)
        return _read(existing)

    car = GarageCar(
        customer_id=customer.id,
        vin=payload.vin.upper() if payload.vin else None,
        plate=payload.plate,
        model=payload.model,
        generation=payload.generation,
        year=payload.year,
        drive=payload.drive,
        plant=payload.plant,
        body_type=payload.body_type,
        description=payload.description,
        # Перше авто у гаражі одразу стає активним — інакше підбір порожній.
        is_active=payload.make_active or len(cars) == 0,
    )
    session.add(car)
    session.commit()
    session.refresh(car)
    if car.is_active:
        _activate(session, customer.id, car.id)
        session.refresh(car)
    return _read(car)


@router.patch("/{car_id}", response_model=GarageCarRead)
def update_garage_car(
    car_id: int,
    payload: GarageCarUpdate,
    customer: Customer = Depends(get_current_customer),
    session: Session = Depends(get_session),
):
    car = session.get(GarageCar, car_id)
    if not car or car.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Авто не знайдено в гаражі")

    data = payload.model_dump(exclude_unset=True)
    make_active = data.pop("is_active", None)
    for field, value in data.items():
        if value is not None:
            setattr(car, field, value)
    session.add(car)
    session.commit()
    if make_active:
        _activate(session, customer.id, car.id)
    session.refresh(car)
    return _read(car)


@router.delete("/{car_id}", status_code=204)
def delete_garage_car(
    car_id: int,
    customer: Customer = Depends(get_current_customer),
    session: Session = Depends(get_session),
):
    car = session.get(GarageCar, car_id)
    if not car or car.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Авто не знайдено в гаражі")

    was_active = car.is_active
    session.delete(car)
    session.commit()

    # Якщо видалили активне — активним стає наступне, щоб підбір не «зникав».
    if was_active:
        rest = _customer_cars(session, customer.id)
        if rest:
            _activate(session, customer.id, rest[0].id)
    return None


@router.post("/import", response_model=List[GarageCarRead])
def import_garage(
    payload: GarageImportRequest,
    customer: Customer = Depends(get_current_customer),
    session: Session = Depends(get_session),
):
    """Переносить гараж із localStorage в акаунт (викликається після входу).

    Нічого не перезаписує: якщо в акаунті вже є авто, імпорт лише доповнює
    його тими, яких там немає.
    """
    for item in payload.cars:
        if not item.model:
            continue
        duplicate = False
        for car in _customer_cars(session, customer.id):
            if item.vin and car.vin and car.vin.upper() == item.vin.upper():
                duplicate = True
                break
            if (
                not item.vin
                and not car.vin
                and car.model == item.model
                and (car.generation or "") == (item.generation or "")
            ):
                duplicate = True
                break
        if duplicate:
            continue
        session.add(
            GarageCar(
                customer_id=customer.id,
                vin=item.vin.upper() if item.vin else None,
                plate=item.plate,
                model=item.model,
                generation=item.generation,
                year=item.year,
                drive=item.drive,
                plant=item.plant,
                body_type=item.body_type,
                description=item.description,
                is_active=False,
            )
        )
    session.commit()

    cars = _customer_cars(session, customer.id)
    if cars and not any(car.is_active for car in cars):
        wanted = None
        if payload.active_vin:
            wanted = next(
                (car for car in cars if (car.vin or "").upper() == payload.active_vin.upper()),
                None,
            )
        _activate(session, customer.id, (wanted or cars[0]).id)
        cars = _customer_cars(session, customer.id)

    return [_read(car) for car in cars]
