# Smart Planning — V3

Application React de pilotage industriel. Le classeur est une source initiale ; les pages de travail utilisent des commandes, matières, opérations, fabrications, déclarations et livraisons reliées.

## Démarrer

```sh
npm install
npm run build
npm start
```

Ouvrir http://127.0.0.1:4173/. La base IndexedDB du navigateur est initialisée automatiquement depuis les données métier extraites du fichier. Elle conserve les saisies après rafraîchissement. Aucun écran de connexion.

`npm run dev` lance le serveur Vite de développement sur http://127.0.0.1:5173/. Le mode `build` puis `start` sert la version compilée.

L’interface dispose d’une navigation regroupée par activité, d’un tableau de bord quotidien et d’une présentation adaptée aux mobiles. Les formulaires et fenêtres de détail partagent les mêmes composants ; les fenêtres se ferment avec Échap et restituent le focus au contrôle d’origine. Après une modification du frontend, relancer `npm run build`, puis actualiser le navigateur pour mettre à jour la version servie sur le port 4173.

## Utilisation

- **Vue générale** : exécution du jour, commandes actives, échéances dépassées, besoins matières non couverts, OTIF, liste d’actions et livraisons à préparer. La date de pilotage est sélectionnable ; la situation initiale correspond au 16 novembre 2026.
- **Commandes** : recherche, filtres, tri, avancement, reliquat, priorité, fiche de suivi, création et modification. Depuis la fiche : produire, planifier, enregistrer une livraison ou archiver.
- **Production** : déclaration rattachée à une commande et facultativement à une fabrication planifiée. Les produits finis conformes = produit − rebut ; seules ces quantités avancent la commande. Les opérations intermédiaires restent tracées sans recompter le produit fini.
- **Stocks** : réceptions, consommations et paramètres matières. Les mouvements déjà inclus dans la prévision soldent le besoin prévisionnel correspondant, ce qui évite un double comptage. Les mouvements supplémentaires modifient le stock projeté. Aucun total ne mélange les unités différentes.
- **Capacité** : simulation des heures, shifts, postes, cadence et effectifs. Les valeurs sont enregistrées après validation. Une suggestion de shifts est proposée si l’objectif hebdomadaire n’est pas couvert et si trois shifts suffisent.
- **Planning** : calendrier hebdomadaire du plan source et fabrications nouvelles reliées aux commandes et aux phases. Contrôle de charge quotidien incluant le plan source reconnu, les autres fabrications, dimanches et jours fériés connus. Annulation par archivage.
- **Livraisons** : date et quantité réelles, reliquat, suivi des lignes incomplètes et lien explicite avec une commande lorsqu’il est confirmé. Les livraisons partielles ne marquent pas une commande comme expédiée.
- **Analyse** : historique hebdomadaire structuré depuis la feuille Analyse, sans reprendre ses lignes de total dans les détails.
- **Données** : import métier Excel avec aperçu, rapprochement par référence métier, export Excel, sauvegarde et restauration JSON. Une référence de production ayant déjà des déclarations est conservée au réimport pour éviter le double comptage.

## Calculs

Avancement commande = (production de référence + nouvelles productions finales conformes) / quantité commandée.

Reliquat fabrication = max(0, quantité commandée − production finale conforme).

Stock projeté = stock de référence + mouvements réalisés + réceptions prévues restantes − consommation prévue restante. Le manque à couvrir inclut le stock de sécurité paramétré.

OTD = lignes livrées à l’heure / lignes évaluables. OTIF = lignes livrées à l’heure et complètes / lignes évaluables. Une ligne est évaluable si la date réelle et une quantité numérique sont présentes. Les lignes échues sans réalisation sont signalées en retard. Deux quantités du fichier enregistrées comme dates sont exclues et signalées jusqu’à correction.

Capacité journalière = cadence effective × heures/shift × shifts/jour × nombre de postes. La cadence effective provient de la nomenclature et peut être ajustée ; elle inclut les hypothèses de rendement du fichier. Un poste déclaré indisponible a une capacité nulle.

## Base commune Supabase

1. Vérifier `.env` à partir de `.env.example`. Il ne contient que l’URL et la clé publique.
2. Exécuter **supabase/metier.sql** dans l’éditeur SQL Supabase. Ce petit script est aussi téléchargeable dans Paramètres.
3. Dans l’application, cliquer sur l’indicateur de sauvegarde en haut, puis **Synchroniser**. Les enregistrements métier initiaux sont envoyés par petits lots ; aucun gros script de données n’est requis. Le démarrage suivant synchronise aussi automatiquement la base.
4. Les nouvelles saisies sont sauvegardées localement et envoyées immédiatement dans Supabase lorsque la connexion est active. Une nouvelle tentative automatique a lieu au retour du réseau, au retour sur l’application et chaque minute. Les changements d’autres postes sont récupérés sans remplacer les modifications locales en attente. Une modification concurrente conserve la version du serveur et la version locale en attente.

Les entrées « Données & sauvegarde » et « Paramètres » sont retirées du menu. La fenêtre **Sauvegarde en ligne**, accessible par l’indicateur en haut, affiche l’état réel, le nombre de changements en attente et le script d’initialisation si la table manque. Le logo `/logo.svg` est utilisé dans la navigation et comme icône d’onglet.

Le modèle utilise des enregistrements typés en JSONB dans `myc_records`. Une révision serveur permet de détecter une modification concurrente avant de remplacer une version connue. Les changements locaux restent conservés si l’envoi échoue. En cas de conflit, exporter une sauvegarde avant de choisir de recharger les versions Supabase.

Les anciennes tables `production_entries` et `workbook_rows` ne sont pas supprimées. Les anciens scripts volumineux concernent l’archive Excel et ne sont plus nécessaires à la V3. Les modifications faites dans l’ancien explorateur brut ne sont pas automatiquement transposées dans le modèle métier.

Le script autorise l’accès avec la clé publique, conformément à l’absence de connexion utilisateur. Cela donne l’accès en lecture/écriture à toute personne disposant de l’URL et de cette clé ; l’accès au déploiement doit être maîtrisé. La clé secrète ne figure pas dans le frontend.

## Provenance et périmètre

Le fichier initial est conservé à la racine. `public/classeur.json` conserve les cellules et les formules des 18 feuilles. `public/business-data.json` contient les entités exploitables : 28 commandes, 22 lignes matières, 15 phases, 25 lignes de livraison, 42 observations historiques, 309 lignes de planning, 6 jours fériés et 5 points de vérification.

Les 533 valeurs d’erreur Excel source ne sont pas corrigées silencieusement. Les formules Excel et les simulations auxiliaires ne sont pas toutes transposées dans l’application. Les prévisions de consommation et dates de rupture proviennent du fichier ; le stock projeté est recalculé après les mouvements, mais une nouvelle date de rupture n’est pas calculée automatiquement.

Les unités matières sont à confirmer dans chaque fiche. Les nomenclatures de phases sont importées, mais le lien quantifié produit/matière doit être validé avant de déduire automatiquement des consommations. Les postes représentent des phases et ne remplacent pas un inventaire de machines physiques ; les ressources partagées, dépendances entre phases et besoins de personnel ne sont pas encore résolus par un ordonnanceur automatique. Le calendrier répartit une fabrication également sur ses jours ouverts ; il propose un contrôle de charge, pas une optimisation industrielle complète.

## Vérifications

```sh
npm test
npm run build
```

Les tests couvrent les conversions du classeur, les quantités invalides, l’avancement de production, la séparation des opérations intermédiaires, les mouvements déjà prévus, les livraisons partielles, le rapprochement d’import, les conflits de charge et un parcours React avec sauvegarde IndexedDB et rechargement. Le parcours vérifie aussi l’ouverture et la fermeture du menu mobile et le repérage de la page active. Les dimensions des graphiques sont simulées dans ces tests ; ils ne remplacent pas une inspection visuelle dans un navigateur.

Pour régénérer l’archive source : `python scripts/extract_workbook.py`. Pour comparer les cellules au fichier : `python scripts/verify_workbook.py`. Le script `prebuild` reconstruit automatiquement les données métier à partir de l’archive.
