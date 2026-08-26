Speedtab: L'espace de travail ultra-rapide et local pour Nouvel Onglet qui ne vous piste pas. Conçu en Vanilla JS pur, sans framework et avec une empreinte mémoire minimale.

Speedtab remplace la page par défaut de Nouvel Onglet de votre navigateur par un Pave de raccourcis rapide, dense et axé sur la confidentialité locale. Aucun compte. Aucun serveur central Speedtab. Aucun suivi. Synchronisation distante optionnelle. Juste vos données, à votre façon.

Créez des pages d'accueil personnalisées pour différents contextes, divisez-les en grilles modulaires et organisez votre contenu en onglets. Combinez des favoris visuels, des flux RSS/Atom, des notes rapides, des extraits de code, des listes de liens, des composants HTML et des notes privées chiffrées au sein d'un espace de travail unique et ultra-rapide.

Speedtab est conçu pour la structure, la vitesse et un contrôle total sur vos données :

• aucun compte requis
• aucun service de serveur central Speedtab
• aucun compte cloud requis
• véritable stockage local au sein du navigateur
• exportation/importation portable pour une liberté totale de vos données

Ce que vous pouvez faire avec Speedtab :

• organiser vos favoris en pages, modules et onglets personnalisés
• profiter d'une expérience classique de Pave de raccourcis haute performance adaptée à vos flux de travail
• téléverser des images d'aperçu locales et des favicons personnalisés pour vos favoris
• gérer vos tâches et to-dos avec priorités, dates d'échéance, notes et indicateurs visuels d'état
• créer des notes de texte, de code, de liens, du HTML personnalisé et des notes chiffrées
• construire des structures d'onglets imbriquées et infinies dans vos notes HTML grâce à YaiTabs
• détacher des notes et modules de flux dans des fenêtres flottantes Document Picture-in-Picture (PiP)
• lire des flux RSS/Atom directement sur votre page d'accueil avec des intervalles de rafraîchissement automatique par onglet
• suivre l'état lu/non lu et archiver des éléments de flux intéressants avec des commentaires
• personnaliser le thème visuel, les dispositions de grille et les arrière-plans CSS
• exporter et importer des espaces de travail complets ou des collections individuelles de favoris, notes et ToDo en JSON

Speedtab fonctionne entièrement en local. Les données de l'application sont enregistrées en toute sécurité dans IndexedDB au sein du profil de votre navigateur. La récupération des flux RSS est gérée intégralement par l'extension via le service worker en arrière-plan. Les notes chiffrées sont protégées côté client avec AES-GCM et PBKDF2-SHA256. Vos phrases secrètes ne quittent jamais votre appareil.

Obtenez un véritable espace de travail puissant sur Nouvel Onglet au lieu d'une page d'accueil générique ou d'un tableau de bord cloud intrusif.

----------------------------------------
RÉSUMÉ DÉTAILLÉ DES FONCTIONNALITÉS DE SPEEDTAB
----------------------------------------

INTERFACE PRINCIPALE ET ARCHITECTURE DE L'ESPACE DE TRAVAIL
• Interface plein écran avec navigation multi-pages adaptable pour différents espaces de travail ou catégories de contexte.
• Réorganisation par glisser-déposer pour les pages, modules, collections et éléments individuels.
• Cœur de délégation d'événements propulsé par YaiJS et YEH (Yai Event Hub), s'exécutant sur un moteur unique partagé avec une mise à l'échelle O(1) et zéro surcoût de DOM virtuel.
• Cœur ultra-léger offrant une interface réactive sans la lourdeur d'un DOM virtuel.
• Navigation complète au clavier et prise en charge de l'accessibilité WCAG 2.1 AA (Touches fléchées, Début, Fin, Entrée, Espace).
• Recherche globale dans l'en-tête avec flux de localisation instantané, couche de résultats absolus et mise en surbrillance sur la page.
• Éléments visuels et de disposition :
  - Arrière-plan global par défaut et surcharge d'arrière-plan individuelle par page.
  - Éditeur d'arrière-plan CSS personnalisé avec validation syntaxique en temps réel et archive de dégradés/couleurs enregistrés.
  - Gestion de la disposition par module : grilles auto, multi-colonnes et pleine largeur.
  - Hauteur minimale de module et réglages d'écartement/marge interne de contenu par module.
  - Limites de largeur d'interface et emplacement de la barre de widgets (haut ou bas).

MODULE DE FAVORIS VISUELS
• Rendu de pavés visuels compatible avec des favicons personnalisés ou des images d'aperçu téléversées.
• Outil de rognage intégré (CropperJS) pour rogner les images locales à une proportion fixe avant l'enregistrement.
• Explorateur de fichiers et gestionnaire de favicons :
  - Sélection parmi tous les favicons enregistrés dans les tables de fichiers IndexedDB.
  - Téléversement direct de favicons personnalisés.
  - Outil de détection et de correction automatique pour les favicons sombres à faible contraste/transparence (ajoute une couche d'arrière-plan propre avant l'enregistrement).
• Configuration de navigation : modifiez le comportement d'ouverture par module entre l'onglet actuel et de nouveaux onglets en arrière-plan ou au premier plan.
• Personnalisation de la disposition et des pavés :
  - Mode standard (pavés d'aperçu visuel de 106x60px).
  - Mode liens rapides (grille très compacte de 48x48px axée sur les favicons).
  - Mode grands pavés (aperçus visuels agrandis de 154x80px).
  - Mode de disposition optionnel "titre sous le pavé" pour parcourir les favoris visuels par étiquettes.
  - Couleurs d'arrière-plan personnalisées au niveau du pavé compatibles avec la transparence.

MODULE PAVE DE RACCOURCIS
• Surface dédiée au Pave de raccourcis pleine largeur avec une interface transparente et visuellement minimale.
• Pavés centrés au format 16:9 avec hauteur adaptable et alignement du contenu en haut, au centre ou en bas.
• Onglets optionnels, bouton intégré pour ajouter des pavés et mode hauteur de page complète pour les dispositions de Pave de raccourcis classiques ou catégorisées.
• Fichiers d'images locaux dédiés pour le Pave de raccourcis avec ajustement de la marge interne par image.
• Les couleurs de pavés dérivées des favicons créent des compositions visuelles harmonieuses sans dépendre de services externes de capture ou d'images.

MODULE DE TÂCHES (TODO)
• Module dédié à la gestion des tâches intégré directement dans la grille de votre espace de travail.
• Options de tâches flexibles : priorités, indicateurs de couleur optionnels, notes, dates/heures d'échéance et affichage compact des métadonnées.
• Étiquettes d'état visuelles claires et code couleur pour les tâches ouvertes, terminées à temps, terminées en retard et en retard.
• Mode d'affichage en pavés (tuiles), onglets de module standard et commandes partagées de réglage rapide.

NOTES ET MOTEUR DE NOTES INTERACTIF
• Cinq types de contenu pour les notes :
  - Notes HTML :
    * Rendu HTML nettoyé compatible avec les espaces réservés basés sur les fichiers et les images intégrées.
    * Héberge des structures d'onglets imbriquées YaiTabs interactives directement au cœur du contenu de la note.
    * API de styles basée sur des attributs (attributs data-st-* pour la largeur, la hauteur, les marges, le flexbox, le grid, les bordures, les ombres, la typographie et les couleurs) sans vulnérabilités de styles en ligne.
    * Macros prédéfinies pour insérer des schémas et des modèles de composants dans l'éditeur.
  - Notes de texte : Éditeur de texte simple pour des prises de notes rapides sans mise en forme.
  - Notes de liens : Convertit les URLs en texte brut directement ligne par ligne en listes de liens interactives ; les blocs de texte sans URL s'affichent sous forme de citations structurées.
  - Notes de code : Extraits de code enregistrés en police monospace avec coloration syntaxique automatique via Highlight.js.
  - Notes chiffrées : Notes privées chiffrées côté client avec AES-GCM et PBKDF2-SHA256 (310 000 itérations). Nécessitent une phrase secrète pour être déverrouillées ; les phrases secrètes ne sont jamais enregistrées ni mises en cache.
• Modes de l'éditeur de notes :
  - Éditeur en vue divisée standard avec aperçu en direct activable pour les notes HTML.
  - Configuration à la volée : Modifiez le contenu d'onglets dans des notes HTML profondément imbriquées depuis une surface de configuration dédiée sans naviguer dans les onglets.
  - Bloc-notes rapide local : Bloc-notes local accessible depuis l'en-tête, enregistré indépendamment des exportations de l'espace de travail.
• Système de fenêtres flottantes et Picture-in-Picture : Les notes peuvent être détachées dans des fenêtres déplaçables et redimensionnables avec ordre de focalisation, ou ouvertes dans des fenêtres natives Document Picture-in-Picture (PiP) avec synchronisation du contenu en temps réel.

MODULE LECTEUR DE FLUX RSS
• Module lecteur de flux RSS/Atom intégré pouvant être placé sur n'importe quelle grille de modules de la page.
• Gestion des flux RSS : ajoutez, vérifiez et découvrez automatiquement les liens RSS/Atom masqués dans les URLs de domaines web standards.
• Fonctionnalités du lecteur :
  - Filtrage par source et limites personnalisables d'articles visibles.
  - Suivi de l'état lu et non lu avec actions groupées pour marquer les éléments.
  - Gestionnaire d'archives pour enregistrer des articles localement avec des commentaires optionnels.
  - Vue lecteur agrandie : Agrandit les modules de flux vers une vue de lecture dédiée pleine largeur avec largeur de colonne de lecture ajustable.
  - Prise en charge de Document Picture-in-Picture (PiP) : Détachez les modules de flux dans des fenêtres flottantes sur le bureau en conservant la position de défilement et la mise à jour du contenu en temps réel.
  - Filtre de texte local au sein du flux pour rechercher des articles chargés en temps réel.
  - Rafraîchissement automatique par onglet de flux avec des intervalles configurables tant que l'onglet reste ouvert.
  - La récupération des données entre origines (cross-origin) est effectuée en toute sécurité par le service worker en arrière-plan.

BARRE DE WIDGETS ET OUTILS
• Barre de widgets modulaire placée en haut ou en bas des pages de l'espace de travail.
• Outils d'horloge et de gestion du temps :
  - Planificateur centralisé partagé App Clock alimentant les horloges synchronisées et les minuteurs de tâches.
  - Modes d'affichage d'horloge Numérique ou Analogique activables.
  - Format de date/heure localisable, outils d'insertion de caractères, taille de police personnalisée, alignement et couleurs des éléments par composant.
  - Chronomètre local et outils de minuteurs multiples s'exécutant dans une boucle DOM en temps réel sans impact sur les performances.
• Système météo :
  - Affichage de la température compact dans la barre avec recherche d'emplacement personnalisée et sélecteur d'unités (Celsius/Fahrenheit).
  - Prévisions météo hebdomadaires détaillées accessibles directement depuis la barre.
• Indicateur d'état pour la synchronisation distante avec retours visuels.

MENUS CONTEXTUELS DE CAPTURE ET BOÎTE DE RÉCEPTION
• Intégration au menu contextuel du navigateur : Cliquez avec le bouton droit sur n'importe quelle page web ou sélection de texte pour exécuter "Ajouter au Bloc-notes rapide" sans changer d'onglet.
• Compteur en temps réel dans l'onglet : Les titres des onglets en arrière-plan se mettent à jour dynamiquement pour afficher les éléments en attente (ex. BOÎTE DE RÉCEPTION [3] - Speedtab).
• Gestionnaire de boîte de réception avancé : Panneau dédié dans l'en-tête pour réviser, modifier, filtrer et enregistrer les extraits capturés dans des modules spécifiques de favoris ou de notes.

PROPRIÉTÉ DES DONNÉES, STOCKAGE ET SYNCHRONISATION DISTANTE
• Stockage 100% local : Tous les états de l'application, structures de modules et fichiers binaires sont enregistrés dans IndexedDB sur le client via Dexie.
• Échange de données JSON portable :
  - Fichiers d'exportation JSON vérifiés par somme de contrôle (speedtab-export-<checksum>.json).
  - Importation et exportation compactes en format JSON pour les collections de favoris visuels, notes et onglets ToDo.
  - Moteur de fusion d'enregistrements intelligent pour transférer des espaces de travail entre profils de navigateur sans duplication.
  - Interface utilitaire d'importation/exportation isolée (import-export.html).
• Synchronisation cloud optionnelle :
  - Synchronisation WebDAV : Envoi, obtention, comparaison du contenu distant et vérifications d'état manuelles.
  - Synchronisation Google Drive : Synchronisation via OAuth avec chrome.identity dans le dossier masqué appDataFolder de l'utilisateur, incluant des intervalles d'envoi automatique et la vérification de l'état de l'espace de travail distant.

MAINTENANCE DU SYSTÈME ET TRIEUR DE GRILLE
• Trieur de grille dédié (sorter.html) : Page de configuration isolée pour réorganiser les hiérarchies de pages de l'espace de travail, modifier les titres d'onglets en ligne et effectuer des suppressions en cascade.
• Gestionnaire de nettoyage du système : Analyse les tables locales de la base de données pour détecter et supprimer les enregistrements orphelins, les ressources binaires inutilisées et les favicons obsolètes.

INTERNATIONALISATION ET LOCALISATION NATIVE
• Internationalisation de l'extension basée sur chrome.i18n natif.
• Traductions complètes de l'interface et espaces de travail d'exemple localisés pour l'anglais, l'allemand, le néerlandais, le turc, l'hindi, le russe, le chinois (simplifié), l'espagnol et le français.


----------------------------------------
PERFORMANCES ET TAILLE
----------------------------------------

• Taille de l'extension compressée (.ZIP) : ~710 Ko
• Gestionnaire de tâches de Chrome
  - Mémoire : ~50 Mo de mémoire totale / ~5 Mo de tas JavaScript actif
  - Utilisation du processeur : 1-10% en cours d'utilisation active
  - ~40 écouteurs d'événements au total pour l'ensemble de l'extension
  - Interface utilisateur réactive sans le surcoût d'un DOM virtuel
