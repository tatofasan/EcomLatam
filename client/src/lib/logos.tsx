export const LatinEcomLogo = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 700 150"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <text x="50" y="90" fontFamily="Arial" fontSize="70" fontWeight="bold" fill="#3c98e0">Latin</text>
      <text x="270" y="90" fontFamily="Arial" fontSize="70" fontWeight="bold" fill="#4aaeed">Ecom</text>
      <path d="M50,105 L450,105" stroke="#4aaeed" strokeWidth="5" />
    </g>
  </svg>
);
