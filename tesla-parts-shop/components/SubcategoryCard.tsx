import React from 'react';
import { Subcategory } from '../types';
import { ChevronRight, Folder } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SubcategoryCardProps {
  subcategory: Subcategory;
  to: string;
}

const SubcategoryCard: React.FC<SubcategoryCardProps> = ({
  subcategory,
  to,
}) => {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl shadow-xs border border-gray-100 hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer group overflow-hidden flex items-center p-3 sm:p-6 select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="w-24 h-16 sm:w-48 sm:h-[108px] bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden mr-3 sm:mr-6 flex items-center justify-center">
        {subcategory.image ? (
          <img
            src={subcategory.image}
            alt={subcategory.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Folder className="w-6 h-6 sm:w-10 sm:h-10" />
          </div>
        )}
      </div>

      <div className="flex-grow min-w-0">
        <h3 className="font-bold text-sm sm:text-lg text-gray-900 group-hover:text-tesla-red transition-colors pr-2 leading-tight">
          {subcategory.name}
        </h3>
        {subcategory.code && (
          <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-1 sm:mt-2">
            {subcategory.code}
          </span>
        )}
      </div>

      <div className="text-gray-400 group-hover:text-tesla-red transition-all duration-200 flex-shrink-0 ml-2 group-hover:translate-x-1">
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
    </Link>
  );
};

export default SubcategoryCard;
