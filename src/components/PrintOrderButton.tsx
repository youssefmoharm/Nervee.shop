export function PrintOrderButton() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="sticky bottom-4 right-4 z-50">
      <button
        onClick={handlePrint}
        className="bg-navy text-white px-6 py-3 rounded-full shadow-lg hover:bg-navy-2 transition-all transform hover:scale-105 flex items-center gap-2"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        <span>Print Order</span>
      </button>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-order, #printable-order * {
            visibility: visible;
          }
          #printable-order {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .sticky.bottom-4.right-4 {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
