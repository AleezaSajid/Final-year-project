import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext.jsx';
import reportWebVitals from './reportWebVitals';

/** Drop legacy client-side order caches so dashboards rely on the API after load. */
(function clearLegacyOrderCaches() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('orders');
    localStorage.removeItem('recentOrders');
    localStorage.removeItem('customerOrders');
    localStorage.removeItem('sewserve_orders');
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