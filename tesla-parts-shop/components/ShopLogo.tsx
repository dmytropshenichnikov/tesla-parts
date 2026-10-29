import { Link } from 'react-router-dom';
import teslaLogo from '../static/tesla-logo.png';
// Assuming image_0.png is in the same directory

interface TeslaPartsCenterLogoProps {
  /** `light` — для темних фонів (футер): білий напис + контрастний підпис. */
  variant?: 'default' | 'light';
};

const TeslaPartsCenterLogo = ({ variant = 'default' }: TeslaPartsCenterLogoProps) => {
  const light = variant === 'light';
  return (
    <Link to="/" className="cursor-pointer flex items-center gap-2 sm:gap-2.5 flex-shrink-0 group">
      <img
        src={teslaLogo}
        // alt = назва бренду: Google бере його як один із сигналів «site name»
        // (і це коректніше для скрін-рідерів, ніж «Tesla Logo»)
        alt="Tesla Parts Center"
        width={256}
        height={256}
        className="h-7 w-7 sm:h-8 sm:w-8 object-contain transition-transform duration-300 group-hover:scale-105"
      />
      <div className="flex flex-col select-none justify-center">
        <span
          className={`font-montserrat font-black text-sm sm:text-base tracking-wider leading-none group-hover:text-tesla-red transition-colors ${
            light ? 'text-white' : 'text-tesla-dark'
          }`}
        >
          TESLA
        </span>
        <span
          className={`font-montserrat font-bold text-[9px] sm:text-[10px] tracking-[0.25em] uppercase leading-none mt-0.5 ${
            light ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          PARTS CENTER
        </span>
      </div>
    </Link>
  );
};

export default TeslaPartsCenterLogo;
