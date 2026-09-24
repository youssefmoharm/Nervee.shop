import { Navigate, useLocation } from 'react-router-dom';

/**
 * /guest-order is a legacy alias — the canonical guest tracking page is
 * /track-order (single implementation in TrackOrder.tsx).
 */
export default function GuestOrder() {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: '/track-order', search: location.search }}
      replace
      state={location.state}
    />
  );
}
