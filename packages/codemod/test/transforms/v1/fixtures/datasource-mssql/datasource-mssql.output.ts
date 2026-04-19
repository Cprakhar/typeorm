import { DataSource } from "typeorm"

const dataSource = new DataSource({
    type: "mssql",

    authentication: {
        type: "ntlm",

        options: {
            domain: "MYDOMAIN",
            userName: getEnv("DB_USER"),
            password: getEnv("DB_PASSWORD"),
        },
    },

    options: {
        isolationLevel: "READ COMMITTED",
        connectionIsolationLevel: "REPEATABLE READ",
    },
})
