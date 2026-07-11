update public.pricing_plans
set metadata = metadata || case id
  when 'free' then jsonb_build_object(
    'cta', 'Creer un compte',
    'badge', 'DECOUVERTE',
    'tagline', 'Teste HuggyFlow sans carte bancaire.'
  )
  when 'basic' then jsonb_build_object(
    'cta', 'Commencer avec Creator',
    'badge', 'POUR COMMENCER',
    'tagline', 'Les essentiels pour publier regulierement.'
  )
  when 'pro' then jsonb_build_object(
    'cta', 'Passer a Pro',
    'badge', 'LE PLUS CHOISI',
    'tagline', 'Pour creer, tester et publier chaque semaine.'
  )
  when 'crew' then jsonb_build_object(
    'cta', 'Creer une equipe',
    'badge', 'EQUIPE',
    'tagline', 'Un espace partage pour produire ensemble.'
  )
  when 'squad' then jsonb_build_object(
    'cta', 'Passer a Squad',
    'badge', 'EQUIPE EN CROISSANCE',
    'tagline', 'Plus de volume, plus de controle, moins d attente.'
  )
  when 'max' then jsonb_build_object(
    'cta', 'Choisir Max',
    'badge', 'AGENCE',
    'tagline', 'Pour les studios et agences multi-clients.'
  )
  when 'scale' then jsonb_build_object(
    'cta', 'Passer a Scale',
    'badge', 'SCALE',
    'tagline', 'Un moteur de production pour plusieurs marques.'
  )
  when 'enterprise' then jsonb_build_object(
    'cta', 'Parler a l equipe',
    'badge', 'ENTREPRISE',
    'tagline', 'Capacite, securite et accompagnement dedies.'
  )
  else '{}'::jsonb
end
where id in ('free','basic','pro','crew','squad','max','scale','enterprise');
