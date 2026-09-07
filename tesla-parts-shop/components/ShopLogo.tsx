import { Link } from 'react-router-dom';
import teslaLogo from '../static/tesla-logo.png';
// Assuming image_0.png is in the same directory

const TeslaPartsCenterLogo = () => {
  return (
    <Link to="/" className="cursor-pointer flex items-center gap-2 sm:gap-3 flex-shrink-0">
      <img
        src={teslaLogo}
        alt="Tesla Logo"
        className="h-8 sm:h-10 md:h-12 w-auto object-contain"
      />
      <div className="flex flex-col items-start font-tesla tracking-tight">
        <span className="text-tesla-red font-bold text-base sm:text-xl md:text-2xl leading-none">
          TESLA
        </span>
        <span className="text-black font-bold text-base sm:text-xl md:text-2xl leading-none">
          PARTS
        </span>
        <span className="text-black font-bold text-base sm:text-xl md:text-2xl leading-none">
          CENTER
        </span>
      </div>
    </Link>
  );
};

export default TeslaPartsCenterLogo;
