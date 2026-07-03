-- Durcissement: la fonction utilitaire SECURITY DEFINER ne doit pas etre appelable via l'API publique.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
