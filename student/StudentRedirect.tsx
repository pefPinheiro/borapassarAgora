import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const StudentRedirect: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [hasUser, setHasUser] = useState(false);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setHasUser(!!user);
        setLoading(false);
    };

    if (loading) {
        return null; // Or a loading spinner
    }

    if (hasUser) {
        return <Navigate to="meus-cursos" replace />;
    }

    return <Navigate to="catalogo" replace />;
};

export default StudentRedirect;
