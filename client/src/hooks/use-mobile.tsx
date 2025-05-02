import { useState, useEffect } from 'react';

// Named export para un hook personalizado
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Función para verificar si la pantalla es de móvil (menos de 768px)
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Verificar al montar
    checkIfMobile();

    // Agregar event listener para cambios de tamaño
    window.addEventListener('resize', checkIfMobile);

    // Limpiar el event listener al desmontar
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  return isMobile;
}