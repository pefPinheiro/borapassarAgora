import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AuthGuardProps {
    children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const location = useLocation();

    useEffect(() => {
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
    };

    if (isAuthenticated === null) {
        // Loading State
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#f8fafc]">
                <div className="size-10 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verificando Credenciais...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        // Redirect to login, saving the location they were trying to go to
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

export default AuthGuard;
