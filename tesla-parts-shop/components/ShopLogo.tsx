import { Link } from 'react-router-dom';
import teslaLogo from '../static/tesla-logo.png';
// Assuming image_0.png is in the same directory

const TeslaPartsCenterLogo = () => {
  return (
    <Link to="/" className="cursor-pointer flex items-center gap-2 sm:gap-2.5 flex-shrink-0 group">
      <img
        src={teslaLogo}
        alt="Tesla Logo"
        className="h-7 sm:h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
      />
      <div className="flex flex-col select-none justify-center">
        <span className="font-montserrat font-black text-sm sm:text-base tracking-wider text-tesla-dark leading-none group-hover:text-tesla-red transition-colors">
          TESLA
        </span>
        <span className="font-montserrat font-bold text-[9px] sm:text-[10px] tracking-[0.25em] text-gray-500 uppercase leading-none mt-0.5">
          PARTS CENTER
        </span>
      </div>
    </Link>
  );
};

export default TeslaPartsCenterLogo;
