
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qkxincrpiazyveilogn.supabase.co'; // Based on screenshot
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFreGluY3JwaWF6Znl2ZWlsb2duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA5MjgwNSwiZXhwIjoyMDgzNjY4ODA1fQ.TK0jUMncdtZAJbkEcZf_yLMB2CGC5H_xSz30RxBJz1U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('enrollments').select('*').limit(1);
    
    if (error) {
        console.error('Error fetching enrollments:', error);
        return;
    }
    
    console.log('Successfully fetched enrollment:', data);
    
    if (data.length > 0) {
        const testId = data[0].id;
        console.log(`Attempting to update status to "Pendente" for enrollment ${testId} (to ensure update works)`);
        
        const { error: updateError } = await supabase
            .from('enrollments')
            .update({ status: 'Pendente', updated_at: new Date().toISOString() })
            .eq('id', testId);
            
        if (updateError) {
            console.error('Error updating status:', updateError);
        } else {
            console.log('Successfully updated status!');
        }
    }
}

test();
