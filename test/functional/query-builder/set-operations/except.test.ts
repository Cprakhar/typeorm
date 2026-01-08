import "reflect-metadata"
import { expect } from "chai"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { DataSource } from "../../../../src/data-source/DataSource"
import { User } from "./entity/User"
import { DriverUtils } from "../../../../src/driver/DriverUtils"

describe("query builder > set operations > except", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                entities: [__dirname + "/entity/*{.js,.ts}"],
                schemaCreate: true,
                dropSchema: true,
                enabledDrivers: [
                    "postgres",
                    "mysql",
                    "mariadb",
                    "sqlite",
                    "better-sqlite3",
                    "mssql",
                    "oracle",
                ],
            })),
    )
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    it("should perform basic EXCEPT operation", () =>
        Promise.all(
            connections.map(async (connection) => {
                // Skip if EXCEPT is not supported
                // PostgreSQL: All versions support EXCEPT
                // SQLite: All versions support EXCEPT
                // MySQL: Does not support EXCEPT
                // MariaDB: 10.3+ supports EXCEPT
                // SQL Server: All versions support EXCEPT
                // Oracle: Uses MINUS instead (handled in code)
                const driverType = connection.driver.options.type
                if (
                    driverType !== "postgres" &&
                    driverType !== "cockroachdb" &&
                    !DriverUtils.isSQLiteFamily(connection.driver) &&
                    driverType !== "mssql" &&
                    driverType !== "oracle"
                ) {
                    // Skip MySQL/MariaDB as EXCEPT is not widely supported
                    return
                }

                // Insert test data
                const user1 = new User()
                user1.name = "Alice"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "Bob"
                user2.status = "active"
                await connection.manager.save(user2)

                const user3 = new User()
                user3.name = "Charlie"
                user3.status = "active"
                await connection.manager.save(user3)

                // Get all active users EXCEPT Bob
                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.status = :status", { status: "active" })
                    .except(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.name = :name", { name: "Bob" }),
                    )
                    .getRawMany()

                expect(result).to.have.lengthOf(2)
                const names = result.map((r) => r.name).sort()
                expect(names).to.deep.equal(["Alice", "Charlie"])
            }),
        ))

    it("should handle EXCEPT with no exclusions", () =>
        Promise.all(
            connections.map(async (connection) => {
                // Skip if EXCEPT is not supported
                const driverType = connection.driver.options.type
                if (
                    driverType !== "postgres" &&
                    driverType !== "cockroachdb" &&
                    !DriverUtils.isSQLiteFamily(connection.driver) &&
                    driverType !== "mssql" &&
                    driverType !== "oracle"
                ) {
                    return
                }

                const user1 = new User()
                user1.name = "User1"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "User2"
                user2.status = "active"
                await connection.manager.save(user2)

                // Exclude inactive users (none exist) from active users
                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.status = :status", { status: "active" })
                    .except(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.status = :status2", {
                                status2: "inactive",
                            }),
                    )
                    .getRawMany()

                expect(result).to.have.lengthOf(2)
            }),
        ))

    it("should use MINUS for Oracle database", () =>
        Promise.all(
            connections.map(async (connection) => {
                // Only test with Oracle
                if (connection.driver.options.type !== "oracle") {
                    return
                }

                const user1 = new User()
                user1.name = "Test"
                user1.status = "active"
                await connection.manager.save(user1)

                const qb = connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .except(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.id = 999"),
                    )

                const sql = qb.getQuery()
                expect(sql).to.include("MINUS")
                expect(sql).to.not.include("EXCEPT")
            }),
        ))
})
