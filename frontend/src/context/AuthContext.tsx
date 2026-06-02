import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  companyName?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  selectedCompanyId: string | null;
  selectedCompanyName: string | null;
  selectCompany: (id: string, name: string) => void;
  clearSelectedCompany: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);
  const [selectedCompanyName, setSelectedCompanyNameState] = useState<string | null>(null);
  
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedTenantId = localStorage.getItem('selected_tenant_id');
    const storedTenantName = localStorage.getItem('selected_tenant_name');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      
      if (parsedUser.role !== 'SUPER_ADMIN') {
        setSelectedCompanyIdState(parsedUser.companyId || null);
        setSelectedCompanyNameState(parsedUser.companyName || null);
      } else {
        setSelectedCompanyIdState(storedTenantId);
        setSelectedCompanyNameState(storedTenantName);
      }
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);

    if (newUser.role !== 'SUPER_ADMIN') {
      setSelectedCompanyIdState(newUser.companyId || null);
      setSelectedCompanyNameState(newUser.companyName || null);
    } else {
      localStorage.removeItem('selected_tenant_id');
      localStorage.removeItem('selected_tenant_name');
      setSelectedCompanyIdState(null);
      setSelectedCompanyNameState(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selected_tenant_id');
    localStorage.removeItem('selected_tenant_name');
    setToken(null);
    setUser(null);
    setSelectedCompanyIdState(null);
    setSelectedCompanyNameState(null);
  };

  const selectCompany = (id: string, name: string) => {
    localStorage.setItem('selected_tenant_id', id);
    localStorage.setItem('selected_tenant_name', name);
    setSelectedCompanyIdState(id);
    setSelectedCompanyNameState(name);
  };

  const clearSelectedCompany = () => {
    localStorage.removeItem('selected_tenant_id');
    localStorage.removeItem('selected_tenant_name');
    setSelectedCompanyIdState(null);
    setSelectedCompanyNameState(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      isAuthenticated: !!token,
      selectedCompanyId,
      selectedCompanyName,
      selectCompany,
      clearSelectedCompany
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
