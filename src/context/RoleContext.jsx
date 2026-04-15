import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ROLE_CHANGE_EVENT,
  clearUserRole,
  getUserRole,
  setUserRole,
} from "../utils/userRole";

const RoleContext = React.createContext(null);

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState(() => getUserRole());

  useEffect(() => {
    setRoleState(getUserRole());
  }, []);

  useEffect(() => {
    const onRoleChange = (event) => {
      setRoleState(event.detail ?? getUserRole());
    };
    window.addEventListener(ROLE_CHANGE_EVENT, onRoleChange);
    return () => window.removeEventListener(ROLE_CHANGE_EVENT, onRoleChange);
  }, []);

  const setRole = useCallback((newRole) => {
    setUserRole(newRole);
  }, []);

  const clearRole = useCallback(() => {
    clearUserRole();
  }, []);

  const value = useMemo(() => ({ role, setRole, clearRole }), [role, setRole, clearRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (ctx == null) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return ctx;
}
