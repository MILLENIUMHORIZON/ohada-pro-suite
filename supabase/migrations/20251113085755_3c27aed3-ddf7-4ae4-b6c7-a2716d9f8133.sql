-- Activer les mises à jour en temps réel pour les tables comptables
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.journals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_moves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_move_lines;