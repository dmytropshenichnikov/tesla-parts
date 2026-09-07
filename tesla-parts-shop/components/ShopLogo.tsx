import { Link } from 'react-router-dom';
import teslaLogo from '../static/tesla-logo.png';
// Assuming image_0.png is in the same directory

const TeslaPartsCenterLogo = () => {
  return (
    <Link to="/" className="cursor-pointer flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
      <img
        src={teslaLogo}
        alt="Tesla Logo"
        className="h-7 sm:h-9 md:h-11 w-auto object-contain"
      />
      <div className="flex flex-col items-start font-tesla tracking-tight select-none">
        <span className="text-tesla-red font-black text-xs sm:text-lg md:text-xl leading-[0.95]">
          TESLA
        </span>
        <span className="text-black font-black text-xs sm:text-lg md:text-xl leading-[0.95]">
          PARTS
        </span>
        <span className="text-black font-black text-xs sm:text-lg md:text-xl leading-[0.95]">
          CENTER
        </span>
      </div>
    </Link>
  );
};

export default TeslaPartsCenterLogo;
