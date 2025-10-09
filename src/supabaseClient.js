import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lkgnbkblznqilfpcutww.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZ25ia2Jsem5xaWxmcGN1dHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4Njk1MjMsImV4cCI6MjA3NTQ0NTUyM30.LnYgdOuYqOaFnSZpGUTlstRu3A2eRS0KVyS9q5f9Bgc";

export const supabase = createClient(supabaseUrl, supabaseKey);
