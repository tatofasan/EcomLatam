export const EcomdropLogo = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 600 150" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <text x="50" y="90" fontFamily="Arial" fontSize="65" fontWeight="bold" fill="#3c98e0">Ecom</text>
      <text x="210" y="90" fontFamily="Arial" fontSize="65" fontWeight="bold" fill="#4aaeed">Latam</text>
      <path d="M50,105 L350,105" stroke="#4aaeed" strokeWidth="5" strokeDasharray="20,10" />
    </g>
  </svg>
);
