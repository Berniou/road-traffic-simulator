# Suivi temps réel de véhicules — Vue Admin

**Le but** : suivre en temps réel une flotte simulée sur une carte de Paris, sans rechargement.

**Ce que ça fait** : 7 véhicules émettent une position toutes les 50 ms ; un filtrage de 300 ms ne garde que la dernière position ; l'API la diffuse en WebSocket et la persiste dans PostgreSQL.

L'interface affiche une carte OpenStreetMap/MapLibre GL JS, les itinéraires OSRM colorés, les véhicules orientés et animés, avec reconnexion automatique.

**Technos** : Opencode, Claude Sonnet, Kimi K3.1-pro, Deepseekv4.1-flash free, Javascript, Kafka, Kafka Streams, PostgreSQL, WebSocket, OSRM, MapLibre GL JS, OpenStreetMap.

**Approche PRD + agents** : Conception d'une architecture du projet ; Génération et correction d'un PRD avec un agent; Génération de 15 user stories en 5 epics par un agent, avec critères d'acceptation vérifiables ; les agents IA ont implémenté les US-01 à US-12 à partir de ces spécifications.

**État** : 12 US terminées, 3 en attente (rétention Kafka 50 Mo, latence < 2 s, observabilité).

**Hors V1** : client embarqué, historique, authentification, capteurs réels.
