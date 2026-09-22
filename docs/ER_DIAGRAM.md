# Entity-Relationship Diagram

Data lives in Firebase Firestore as flat collections (`users`, `vehicles`,
`stations`, `bookings`, `reviews`, `notifications`, `invoices`, `payments`,
`blockchain_blocks`), each document holding a numeric, auto-incrementing
`id` plus foreign-key fields (e.g. a booking document stores `userId`,
`stationId`, `vehicleId`). The relationships below are enforced in
application code rather than by a schema, which is normal for a document
database — this diagram shows the *logical* relational shape.

```mermaid
erDiagram
    USER ||--o{ VEHICLE : owns
    USER ||--o{ BOOKING : makes
    USER ||--o{ STATION : "owns (role=owner)"
    USER ||--o{ REVIEW : writes
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ PAYMENT : pays

    VEHICLE ||--o{ BOOKING : "used in"

    STATION ||--o{ BOOKING : "booked at"
    STATION ||--o{ REVIEW : "reviewed for"

    BOOKING ||--|| INVOICE : "generates (on completion)"
    BOOKING ||--o{ PAYMENT : "paid via (one successful)"
    BOOKING ||--o| REVIEW : "may have"

    PAYMENT ||--|| BLOCKCHAIN_BLOCK : "recorded as"

    USER {
        int id PK
        string name
        string email
        string passwordHash
        string role "user | owner | admin"
    }

    VEHICLE {
        int id PK
        int userId FK
        string manufacturer
        string model
        float batteryCapacityKwh
        int currentBatteryPercent
        bool isDefault
    }

    STATION {
        int id PK
        int ownerId FK "null for imported/dataset stations"
        string name
        string address
        float lat
        float lng
        float pricePerKwh
        int totalSlots
        int availableSlots
        string approvalStatus "pending | approved"
        string source "owner_added | seeded_opencharge_map"
        bool isActive
    }

    BOOKING {
        int id PK
        int userId FK
        int vehicleId FK
        int stationId FK
        datetime slotStart
        datetime slotEnd
        int startBatteryPercent
        int targetBatteryPercent
        float estimatedCost
        string status "pending_payment | confirmed | in_progress | completed | cancelled"
        string paymentStatus "unpaid | paid"
        int paymentId FK
    }

    PAYMENT {
        int id PK
        int bookingId FK
        int userId FK
        float amount
        string status "created | success | failed"
        string transactionId
        int blockIndex FK
        string blockHash
    }

    BLOCKCHAIN_BLOCK {
        int index PK
        datetime timestamp
        json data "payment/booking payload"
        string previousHash
        int nonce
        string hash
    }

    REVIEW {
        int id PK
        int userId FK
        int stationId FK
        int bookingId FK
        int rating
        string comment
    }

    INVOICE {
        int id PK
        int bookingId FK
        string filePath
        float energyKwh
        float amount
    }

    NOTIFICATION {
        int id PK
        int userId FK
        string title
        string message
        bool isRead
    }
```

Paste this file's Mermaid block into <https://mermaid.live> for an
interactive view, or view it directly on GitHub, which renders Mermaid
fenced code blocks natively.
