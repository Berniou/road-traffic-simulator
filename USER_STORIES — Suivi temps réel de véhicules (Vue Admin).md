# User stories — Suivi temps réel de véhicules (Vue Admin)

Le périmètre est organisé en **5 epics** : simulation et ingestion, traitement temps réel, API et persistance, interface Admin, exploitation et performances.

> **Lecture des statuts** : les user stories sont actuellement indiquées **En attente**, aucune réalisation terminée n’étant documentée dans le PRD.

## Epic 1 — Simulation et ingestion des positions

### US-01 — Configurer le nombre de véhicules simulés

**Statut : Terminée**

**En tant qu’exploitant de la plateforme**,  
je veux configurer le nombre de véhicules simulés, avec une valeur par défaut de 7,  
afin d’adapter la flotte sans modifier le code de l’application.

**Critères d’acceptation**

1. **Étant donné** qu’aucune configuration spécifique n’est fournie, **quand** le simulateur démarre, **alors** 7 véhicules sont créés avec des identifiants distincts.
2. **Étant donné** un nombre de véhicules configuré, **quand** le simulateur démarre, **alors** exactement ce nombre de véhicules est pris en charge.
3. Chaque véhicule possède un `carId` unique et est associé à son propre itinéraire.
4. Le passage de 7 à un autre nombre de véhicules ne nécessite aucune modification du code source.
5. Le dimensionnement de Kafka et des ressources peut être adapté par configuration pour accompagner l’augmentation du nombre de véhicules.

---

### US-02 — Publier les positions brutes dans Kafka

**Statut : Terminée**

**En tant qu’exploitant de la plateforme**,  
je veux que chaque véhicule publie régulièrement sa position dans Kafka,  
afin d’alimenter la chaîne de suivi temps réel.

**Critères d’acceptation**

1. Chaque véhicule émet indépendamment une position toutes les **50 ms**, soit environ **20 événements par seconde**.
2. Les véhicules peuvent démarrer à des instants différents sans se bloquer mutuellement.
3. Avec 7 véhicules démarrés, le topic `car.positions.raw` reçoit environ **140 messages/s, avec une tolérance de ±10 %**.
4. Chaque message est publié avec `carId` comme clé Kafka.
5. Les événements d’un même véhicule sont consommés dans leur ordre de publication.
6. Chaque message contient les champs `carId`, `lat`, `lng`, `heading`, `speed`, `routeId` et `ts`.
7. `ts` correspond à l’horodatage d’émission exprimé en millisecondes.
8. Le simulateur reste capable d’alimenter ultérieurement le client embarqué, sans que celui-ci fasse partie de cette version.

---

## Epic 2 — Filtrage Kafka Streams

### US-03 — Conserver la dernière position de chaque fenêtre

**Statut : Terminée**

**En tant qu’administrateur de flotte**,  
je veux recevoir uniquement la position la plus récente de chaque véhicule à intervalle régulier,  
afin de disposer d’une information actualisée sans surcharger l’interface.

**Critères d’acceptation**

1. Les événements sont regroupés par véhicule dans des **fenêtres fixes et non glissantes de 300 ms**.
2. Pour chaque véhicule et chaque fenêtre, au maximum un événement est publié dans `car.positions.latest`.
3. L’événement retenu est celui dont le champ `ts` est le plus récent, et non nécessairement le dernier reçu par Kafka Streams.
4. Si plusieurs positions d’un même véhicule arrivent dans le désordre, celle ayant le plus grand `ts` est conservée.
5. Si aucun événement n’est reçu pour un véhicule pendant une fenêtre, aucun message n’est produit pour ce véhicule.
6. Les fenêtres des différents véhicules sont traitées indépendamment.
7. Avec 7 véhicules actifs, le débit de sortie est d’environ **3,3 messages/s/véhicule**, soit environ **23 messages/s au total**.

---

## Epic 3 — API, diffusion et persistance

### US-04 — Diffuser les positions au WebSocket Admin

**Statut : Terminée**

**En tant qu’administrateur de flotte**,  
je veux recevoir chaque nouvelle position dès qu’elle est disponible,  
afin de suivre les véhicules sans recharger la page.

**Critères d’acceptation**

1. L’API consomme les messages du topic `car.positions.latest`.
2. Chaque message consommé déclenche sa diffusion vers les clients Admin connectés.
3. Le message diffusé contient au minimum les champs du schéma de position défini dans le PRD.
4. La diffusion d’une position n’attend pas la réception des positions des autres véhicules.
5. La mise à jour d’un véhicule peut être reçue indépendamment des autres.
6. Une indisponibilité temporaire d’un client WebSocket ne doit pas interrompre la consommation Kafka ni la diffusion aux autres clients.

---

### US-05 — Conserver uniquement la dernière position connue

**Statut : Terminée**

**En tant qu’exploitant de la plateforme**,  
je veux persister la dernière position de chaque véhicule,  
afin de restaurer l’état courant de la flotte après un redémarrage de l’API.

**Critères d’acceptation**

1. PostgreSQL contient **une seule ligne par véhicule**.
2. À chaque nouvelle position consommée, la ligne du véhicule concerné est créée si nécessaire, puis mise à jour.
3. Aucun historique des positions n’est conservé dans cette version.
4. Après plusieurs positions successives d’un même véhicule, seule la dernière position connue reste stockée.
5. **Étant donné** des positions déjà enregistrées, **quand** l’API redémarre, **alors** elle peut restituer ces positions sans attendre de nouveaux événements Kafka.
6. Le redémarrage de l’API n’entraîne ni duplication des véhicules ni perte de leur dernière position persistée.

---

### US-06 — Charger l’état initial de la flotte

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux voir les dernières positions connues dès l’ouverture de la vue Admin,  
afin de ne pas attendre le prochain événement temps réel pour afficher les véhicules.

**Critères d’acceptation**

1. L’API expose une ressource permettant de récupérer la dernière position connue de chaque véhicule.
2. À l’ouverture de l’interface, cet appel initial est réalisé avant ou indépendamment de la première notification WebSocket.
3. Chaque véhicule ayant une position persistée est affiché à partir de cette position.
4. Les positions initiales correspondent aux dernières données enregistrées dans PostgreSQL.
5. Après l’initialisation, les notifications WebSocket prennent le relais pour actualiser les positions.
6. L’appel initial ne déclenche pas de rechargement ultérieur de la page.

---

## Epic 4 — Interface Admin

### US-07 — Consulter la carte de la flotte

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux consulter une carte centrée sur Paris 2e,  
afin de visualiser l’environnement géographique dans lequel évoluent les véhicules.

**Critères d’acceptation**

1. La vue « Traffic – Vue Admin » affiche une carte plein écran dans un cadre aux angles arrondis.
2. Le fond de carte utilise des données OpenStreetMap.
3. La carte et les véhicules sont localisés dans Paris, en particulier dans le 2e arrondissement.
4. Le style reprend les grandes couleurs demandées : routes claires, autoroutes jaune-orangé, eau bleu clair et espaces verts vert clair.
5. Le rendu personnalisé repose sur des tuiles vectorielles et une bibliothèque adaptée, telle que MapLibre GL JS.
6. La carte utilise la typographie retenue entre Montserrat et Poppins, sans reprendre les logos ou icônes propriétaires de Google.

---

### US-08 — Visualiser les itinéraires des véhicules

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux voir l’itinéraire associé à chaque véhicule,  
afin de comprendre le trajet qu’il suit.

**Critères d’acceptation**

1. Chaque véhicule possède un itinéraire fixé à l’avance et identifié par `routeId`.
2. L’itinéraire est calculé par le service `route` d’OSRM et sa géométrie GeoJSON est récupérée.
3. Chaque itinéraire est tracé sur la carte avec la couleur principale `#4285F4`.
4. La position du véhicule est cohérente avec son itinéraire.
5. Le service OSRM utilisé couvre Paris, notamment le 2e arrondissement.
6. Une instance OSRM dédiée est prévue pour les environnements autres que la simple démonstration.
7. **Quand** un véhicule atteint l’arrivée, **alors** il repart au point de départ et reparcourt le même itinéraire sans intervention de l’administrateur.

---

### US-09 — Identifier les véhicules et leur état

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux identifier chaque véhicule et comprendre son orientation et son état,  
afin de distinguer rapidement les véhicules sur la carte.

**Critères d’acceptation**

1. Une icône distincte est affichée pour chaque véhicule ayant une position connue.
2. L’icône représente une voiture vue de dessus.
3. Son orientation graphique correspond à la valeur de `heading`.
4. Une modification de `heading` entraîne une modification de l’orientation de l’icône.
5. Le `carId` est visible au moyen d’une étiquette ou d’une infobulle.
6. Un véhicule en mouvement est représenté en vert `#34A853`.
7. Un véhicule à l’arrêt ou en erreur est représenté en rouge `#EA4335`.
8. Aucun véhicule ne porte l’identifiant ou l’icône d’un autre véhicule.

---

### US-10 — Actualiser chaque véhicule indépendamment

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux que chaque véhicule se déplace dès réception de sa propre position,  
afin de suivre une flotte réellement asynchrone.

**Critères d’acceptation**

1. Avec la configuration par défaut, les 7 véhicules sont affichés sur leurs itinéraires respectifs.
2. La réception d’une position met à jour uniquement le véhicule identifié par `carId`.
3. La mise à jour d’un véhicule ne réinitialise ni ne déplace les autres véhicules.
4. Aucune synchronisation globale des véhicules n’est nécessaire pour actualiser l’un d’entre eux.
5. La page et la carte ne sont jamais rechargées lors de la réception d’une position.
6. Deux véhicules ayant des cadences ou des horaires d’émission différents évoluent indépendamment à l’écran.

---

### US-11 — Fluidifier le déplacement des véhicules

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux que les icônes se déplacent progressivement entre deux positions,  
afin de suivre les véhicules sans sauts visuels brutaux.

**Critères d’acceptation**

1. Entre deux positions successives d’un même véhicule, son icône est interpolée plutôt que déplacée instantanément.
2. L’interpolation est propre à chaque véhicule et ne bloque pas les mises à jour des autres.
3. La réception d’une nouvelle position pendant une animation actualise la trajectoire vers la position la plus récente.
4. L’orientation de l’icône reste cohérente avec le cap pendant le déplacement.
5. L’animation ne provoque aucun rechargement de la carte et ne réinitialise pas son niveau de zoom ou son centrage.
6. Le véhicule reste visuellement positionné sur son itinéraire pendant son déplacement.

---

### US-12 — Être informé des coupures et retrouver automatiquement la connexion

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux être informé d’une perte de connexion et retrouver automatiquement le suivi,  
afin de ne pas devoir recharger manuellement l’interface.

**Critères d’acceptation**

1. Un indicateur d’état de connexion est visible dans la vue Admin.
2. Lorsque la connexion est opérationnelle, l’indicateur utilise notamment le vert `#34A853`.
3. Lors d’une coupure du WebSocket, l’indicateur signale clairement la déconnexion.
4. L’interface tente automatiquement de se reconnecter avec une attente progressive entre les tentatives.
5. Les échecs de reconnexion ne provoquent pas de boucle de tentatives sans délai.
6. Après rétablissement de la connexion, l’indicateur redevient opérationnel sans intervention manuelle.
7. L’interface recharge l’état courant des véhicules, puis reprend la réception des mises à jour temps réel.
8. Aucun rechargement manuel de la page n’est nécessaire pour retrouver l’état courant.

---

## Epic 5 — Exploitation et exigences non fonctionnelles

### US-13 — Limiter le stockage Kafka à 50 Mo

**Statut : En attente**

**En tant qu’exploitant de la plateforme**,  
je veux plafonner l’espace disque utilisé par Kafka,  
afin de maîtriser les ressources consommées par la plateforme.

**Critères d’acceptation**

1. Le plafond de **50 Mo** couvre les topics métier, les topics internes Kafka Streams et `__consumer_offsets`.
2. Le budget initial est configuré avec environ 30 Mo pour `car.positions.raw`, 10 Mo pour `car.positions.latest` et 10 Mo de marge pour les topics internes.
3. Le calcul de `retention.bytes` tient compte du nombre de partitions.
4. La configuration de démonstration utilise une partition par topic métier.
5. `segment.bytes` est suffisamment petit, par exemple 2 Mo, pour permettre un nettoyage effectif.
6. Le dépassement ponctuel dû au segment actif reste compatible avec le plafond global retenu.
7. `log.retention.check.interval.ms` est configuré avec une valeur réactive, par exemple 10 secondes.
8. Une `retention.ms` est configurée comme second garde-fou.
9. L’impact du facteur de réplication est intégré au calcul si plusieurs brokers sont utilisés.
10. Après **2 heures de fonctionnement continu avec 7 véhicules**, le stockage Kafka total mesuré reste inférieur à **50 Mo**.

---

### US-14 — Respecter la latence d’affichage temps réel

**Statut : En attente**

**En tant qu’administrateur de flotte**,  
je veux voir les positions avec un faible délai,  
afin que la carte représente correctement la situation courante de la flotte.

**Critères d’acceptation**

1. La latence est mesurée entre l’horodatage d’émission `ts` et l’affichage effectif de la position sur la carte.
2. La mesure inclut l’ingestion Kafka, la fenêtre Kafka Streams de 300 ms, l’API, le WebSocket et le rendu graphique.
3. Dans **95 % des cas**, le délai entre l’émission et l’affichage ne dépasse pas **2 secondes**.
4. Le test est réalisé avec 7 véhicules émettant à la cadence nominale.
5. Les mesures sont conservées avec suffisamment d’informations pour identifier l’étape responsable d’un dépassement.
6. L’animation d’interpolation ne doit pas masquer une latence excessive de la chaîne de données.

---

### US-15 — Observer le fonctionnement du pipeline

**Statut : En attente**

**En tant qu’exploitant de la plateforme**,  
je veux disposer de journaux et de métriques sur le pipeline,  
afin de détecter et diagnostiquer rapidement un dysfonctionnement.

**Critères d’acceptation**

1. Un journal est produit lors de l’émission des positions.
2. Un journal est produit lors de leur consommation par les étapes concernées.
3. Un journal est produit lors de leur diffusion vers le WebSocket Admin.
4. Les journaux permettent de relier un événement à un véhicule, notamment grâce à `carId`, sans journalisation excessive des informations inutiles.
5. Une métrique expose le retard de consommation Kafka, ou *consumer lag*.
6. Le retard de consommation peut être observé séparément pour les étapes concernées.
7. Une interruption ou un ralentissement du pipeline est identifiable à partir des journaux et des métriques disponibles.

---

## Couverture du périmètre

Ces 15 user stories couvrent les exigences **FR-1 à FR-13**, ainsi que les exigences de latence, d’évolutivité, de robustesse, d’observabilité et de rétention Kafka.

Restent explicitement **hors périmètre V1** :

- le client embarqué « Client A » ;
- l’historique des trajets et des positions ;
- l’authentification et la gestion des droits ;
- l’intégration de capteurs réels, tant que la question de la source future des données n’est pas tranchée.
