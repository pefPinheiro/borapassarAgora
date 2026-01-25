
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DebugPolicies: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [errors, setErrors] = useState<any[]>([]);

    useEffect(() => {
        check();
    }, []);

    const check = async () => {
        const errs = [];
        // 1. Check Auth User
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) errs.push({ type: 'Auth', error: authError });
        setUser(user);

        if (user) {
            // 2. Check Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) errs.push({ type: 'Profile Fetch', error: profileError });
            setProfile(profileData);

            // 3. Try to fetch enrollments
            const { data: enrollData, error: enrollError, count } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact' });

            if (enrollError) errs.push({ type: 'Enrollments Fetch', error: enrollError });
            setEnrollments(enrollData || []);
        }

        setErrors(errs);
    };

    return (
        <div className="p-10 space-y-6">
            <h1 className="text-2xl font-bold">Debug de Políticas de Segurança</h1>

            <section className="bg-gray-100 p-4 rounded">
                <h2 className="font-bold">Usuário Atual (Auth)</h2>
                <pre className="text-xs">{JSON.stringify(user, null, 2)}</pre>
            </section>

            <section className="bg-gray-100 p-4 rounded">
                <h2 className="font-bold">Perfil (Tabela profiles)</h2>
                <pre className="text-xs">{JSON.stringify(profile, null, 2)}</pre>
            </section>

            <section className="bg-gray-100 p-4 rounded">
                <h2 className="font-bold">Inscrições Visíveis ({enrollments.length})</h2>
                <pre className="text-xs max-h-40 overflow-auto">{JSON.stringify(enrollments, null, 2)}</pre>
            </section>

            <section className="bg-red-50 p-4 rounded border border-red-200">
                <h2 className="font-bold text-red-600">Erros Encontrados</h2>
                <pre className="text-xs text-red-600">{JSON.stringify(errors, null, 2)}</pre>
            </section>

            <button onClick={check} className="bg-blue-500 text-white px-4 py-2 rounded">Recarregar</button>
        </div>
    );
};

export default DebugPolicies;
