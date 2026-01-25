import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qkxincrpiazfyveilogn.supabase.co';
const supabaseAnonKey = 'sb_publishable_3gs85DH4c9UmQuYhTeTHOA_oA2bOp3y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
