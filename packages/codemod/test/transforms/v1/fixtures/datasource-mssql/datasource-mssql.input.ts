import { DataSource } from "typeorm"

const dataSource = new DataSource({
    type: "mssql",
    domain: "MYDOMAIN",
    username: getEnv("DB_USER"),
    password: getEnv("DB_PASSWORD"),
    options: {
        isolation: "READ_COMMITTED",
        connectionIsolationLevel: "REPEATABLE_READ",
    },
})
