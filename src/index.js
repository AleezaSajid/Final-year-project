import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext.jsx';
import reportWebVitals from './reportWebVitals';

/** Drop legacy client-side caches so data comes from the API. */
(function clearLegacyClientCaches() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('orders');
    localStorage.removeItem('recentOrders');
    localStorage.removeItem('customerOrders');
    localStorage.removeItem('sewserve_orders');
    localStorage.removeItem('measurement_wizard_state');
    localStorage.removeItem('sewserve_testimonials');
    localStorage.removeItem('sewserve_map_last_request');
    localStorage.removeItem('sewserve_pending_order_id');
    localStorage.removeItem('userLocation');
    localStorage.removeItem('sewserve_tailor_profiles');
    localStorage.removeItem('sewserve_wizard_linked_order_id');
    localStorage.removeItem('sewserve_workspace_roles');
  } catch {
    /* ignore */
  }
})();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();