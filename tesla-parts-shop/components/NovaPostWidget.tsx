import React, { useState, useEffect, useRef } from 'react';

interface NovaPostWidgetProps {
  onSelect: (data: {
    ref: string;
    description: string;
    city: string;
    address: string;
  }) => void;
}

const NovaPostWidget: React.FC<NovaPostWidgetProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // Stores the selected branch info to display on the button
  const [selectedBranch, setSelectedBranch] = useState<{
    shortName: string;
    address: string;
    id: string; // The Ref
  } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 1. Get User Location on Mount (for map centering)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error('Location error:', error)
      );
    }
  }, []);

  // 2. Handle Messages from the Iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: only accept messages from Nova Poshta
      if (event.origin !== 'https://widget.novapost.com') return;

      const { data } = event;

      // Case A: User clicked "Close" inside the widget
      if (data === 'closeFrame') {
        setIsOpen(false);
        return;
      }

      // Case B: User selected a branch
      if (typeof data === 'object' && data.id) {
        // 1. Parse the incoming data
        const shortName = data.shortName || 'Відділення';
        const street = data.addressParts?.street ? `вул. ${data.addressParts.street}` : '';
        const building = data.addressParts?.building ? `, ${data.addressParts.building}` : '';
        const streetAddress = `${street}${building}`.trim();
        const city = data.addressParts?.city || '';
        const fullAddress = city
          ? `${city}${streetAddress ? `, ${streetAddress}` : ''}`
          : streetAddress;
        const ref = data.id;

        // 2. Update local state (UI)
        setSelectedBranch({ shortName, address: fullAddress, id: ref });

        // 3. Pass data up to Checkout component
        onSelect({
          ref: ref,
          description: shortName,
          city: city,
          address: streetAddress || fullAddress,
        });

        // 4. Close modal
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('message', handleMessage);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onSelect]);

  // 3. Initialize Iframe when it loads
  const handleIframeLoad = () => {
    if (!iframeRef.current?.contentWindow) return;

    const messageData = {
      placeName: 'Київ', // Fallback center
      latitude: coords?.lat || '',
      longitude: coords?.lng || '',
      domain: window.location.hostname,
      id: selectedBranch?.id || '', // Pass previously selected ID if re-opening
    };

    // Send configuration to the widget
    iframeRef.current.contentWindow.postMessage(messageData, '*');
  };

  return (
    <>
      {/* --- THE BUTTON (Matches Original Design) --- */}
      <div
        onClick={() => setIsOpen(true)}
        className="flex flex-col p-3 px-4 border border-gray-200 rounded-xl bg-white cursor-pointer relative mb-5 hover:border-red-500 transition-colors group"
      >
        {/* Nova Post Logo SVG */}
        <div className="mb-2">
          <svg
            width="129"
            height="18"
            viewBox="0 0 129 18"
            fill="none"
            className="h-5 w-auto"
          >
            {/* ... (SVG paths from your snippet) ... */}
            <path
              d="M9.48791 14.0369V10.6806H6.64191V14.0369H4.46643L7.10879 16.6861C7.64025 17.2189 8.49951 17.2189 9.03096 16.6861L11.6733 14.0369H9.48791ZM3.04095 12.6077V5.38722L0.398589 8.03639C-0.132863 8.56922 -0.132863 9.4307 0.398589 9.96352L3.04095 12.6077ZM6.64191 3.96304V7.31933H9.48791V3.96304H11.6634L9.02103 1.31386C8.48958 0.78104 7.63031 0.78104 7.09886 1.31386L4.4565 3.96304H6.64191ZM15.7263 8.03639L13.0839 5.38722V12.6077L15.7263 9.96352C16.2577 9.4307 16.2577 8.56922 15.7263 8.03639Z"
              fill="#DA291C"
            />
            <path
              d="M24.2303 7.63804V5.12332C24.2303 4.46102 23.7437 3.97302 23.0833 3.97302L20.1561 3.98249V6.64162L21.3653 6.63215V14.0369H24.2353V10.3719H27.8202V14.0369H30.6902V3.96804H27.8202V7.63804H24.2303Z"
              fill="#DA291C"
            />
            <path
              d="M37.2792 3.8235C34.2553 3.8235 32.0457 6.00957 32.0457 9.00234C32.0457 11.9951 34.2553 14.1812 37.2792 14.1812C40.3031 14.1812 42.5126 11.9951 42.5126 9.00234C42.5126 6.00957 40.3031 3.8235 37.2792 3.8235ZM37.2792 11.3727C35.9187 11.3727 34.9157 10.3668 34.9157 9.00234C34.9157 7.63792 35.9187 6.63203 37.2792 6.63203C38.6397 6.63203 39.6427 7.63792 39.6427 9.00234C39.6427 10.3668 38.6397 11.3727 37.2792 11.3727Z"
              fill="#DA291C"
            />
            <path
              d="M51.3858 8.70866C52.0958 8.27543 52.5378 7.53347 52.5378 6.64211C52.5378 5.08846 51.5348 3.96804 49.5387 3.96804H43.8733V14.0319H49.5387C51.6341 14.0319 52.8506 12.8119 52.8506 11.1288C52.8506 10.0532 52.2796 9.17675 51.3858 8.70866ZM46.5397 6.21386H48.6747C49.35 6.21386 49.7373 6.54252 49.7373 7.10522C49.7373 7.66792 49.35 7.99657 48.6747 7.99657H46.5397V6.21386ZM48.8783 11.8209H46.5397V9.95358H48.8783C49.5933 9.95358 49.9955 10.2972 49.9955 10.8898C49.9955 11.4774 49.5933 11.8209 48.8783 11.8209Z"
              fill="#DA291C"
            />
            <path
              d="M57.2347 3.96804L53.2774 14.0319H56.331L56.9666 12.1795H60.9984L61.634 14.0319H64.7472L60.7899 3.96804H57.2347ZM57.7462 9.9237L58.8782 6.63215H59.0967L60.2288 9.9237H57.7462Z"
              fill="#DA291C"
            />
            <path
              d="M78.4567 3.96804H68.8538V6.62717H70.2887V14.0319H73.1587V6.62717H76.7436V14.0319H79.6136V5.11834C79.6037 4.38633 79.1866 3.96804 78.4567 3.96804Z"
              fill="#DA291C"
            />
            <path
              d="M86.1973 3.8235C83.1734 3.8235 80.9639 6.00957 80.9639 9.00234C80.9639 11.9951 83.1734 14.1812 86.1973 14.1812C89.2212 14.1812 91.4307 11.9951 91.4307 9.00234C91.4307 6.00957 89.2261 3.8235 86.1973 3.8235ZM86.1973 11.3727C84.8368 11.3727 83.8338 10.3668 83.8338 9.00234C83.8338 7.63792 84.8368 6.63203 86.1973 6.63203C87.5578 6.63203 88.5608 7.63792 88.5608 9.00234C88.5608 10.3668 87.5628 11.3727 86.1973 11.3727Z"
              fill="#DA291C"
            />
            <path
              d="M103.978 11.3728H101.252V3.96804H98.3872V11.3728H95.6613V3.96804H92.7963V14.0369H106.848V3.96804H103.978V11.3728Z"
              fill="#DA291C"
            />
            <path
              d="M117.955 6.62717V3.96804H108.209V6.62717H111.65V14.0369H114.514V6.62717H117.955Z"
              fill="#DA291C"
            />
            <path
              d="M125.458 14.0369H128.571L124.614 3.97305H121.059L117.102 14.0369H120.155L120.791 12.1845H124.823L125.458 14.0369ZM121.565 9.92373L122.697 6.63218H122.916L124.048 9.92373H121.565Z"
              fill="#DA291C"
            />
          </svg>
        </div>

        {/* Selected Data or Placeholder */}
        <div className="flex flex-col font-medium text-gray-800">
          {selectedBranch ? (
            <>
              <span className="text-base leading-snug">
                {selectedBranch.shortName}
              </span>
              <span className="text-sm font-normal text-gray-500 mt-1">
                {selectedBranch.address}
              </span>
            </>
          ) : (
            <span className="text-gray-500">
              Обрати відділення або поштомат
            </span>
          )}
        </div>

        {/* Right Arrow Icon */}
        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-red-500 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5.49399 1.44891L10.0835 5.68541L10.1057 5.70593C10.4185 5.99458 10.6869 6.24237 10.8896 6.4638C11.1026 6.69642 11.293 6.95179 11.4023 7.27063C11.5643 7.74341 11.5643 8.25668 11.4023 8.72946C11.293 9.0483 11.1026 9.30367 10.8896 9.53629C10.6869 9.75771 10.4184 10.0055 10.1057 10.2942L10.0835 10.3147L5.49398 14.5511L4.47657 13.4489L9.06607 9.21246C9.40722 8.89756 9.62836 8.69258 9.78328 8.52338C9.93272 8.36015 9.96962 8.28306 9.98329 8.24318C10.0373 8.08559 10.0373 7.9145 9.98329 7.7569C9.96963 7.71702 9.93272 7.63993 9.78328 7.4767C9.62837 7.3075 9.40722 7.10252 9.06608 6.78761L4.47656 2.55112L5.49399 1.44891Z"
            />
          </svg>
        </div>
      </div>

      {/* --- THE MODAL OVERLAY --- */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full h-full md:w-[90%] md:h-[90%] md:rounded-lg overflow-hidden flex flex-col relative shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
              <h2 className="text-xl font-bold text-gray-800">
                Вибрати відділення
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-800 text-4xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Iframe */}
            <iframe
              ref={iframeRef}
              src="https://widget.novapost.com/division/index.html"
              className="w-full h-full border-0 bg-gray-50"
              allow="geolocation"
              onLoad={handleIframeLoad}
              title="Nova Poshta Selection"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default NovaPostWidget;
