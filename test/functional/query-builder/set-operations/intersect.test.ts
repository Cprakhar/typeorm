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

describe("query builder > set operations > intersect", () => {
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

    it("should perform basic INTERSECT operation", () =>
        Promise.all(
            connections.map(async (connection) => {
                // Skip if INTERSECT is not supported
                // PostgreSQL: All versions support INTERSECT
                // SQLite: All versions support INTERSECT
                // MySQL: 8.0.31+ supports INTERSECT
                // MariaDB: 10.3+ supports INTERSECT
                // SQL Server: All versions support INTERSECT
                // Oracle: All versions support INTERSECT
                const driverType = connection.driver.options.type
                if (
                    driverType !== "postgres" &&
                    driverType !== "cockroachdb" &&
                    !DriverUtils.isSQLiteFamily(connection.driver) &&
                    driverType !== "mssql" &&
                    driverType !== "oracle"
                ) {
                    // Skip MySQL/MariaDB as version detection would be complex
                    return
                }

                // Insert test data
                const user1 = new User()
                user1.name = "John"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "Jane"
                user2.status = "active"
                await connection.manager.save(user2)

                const user3 = new User()
                user3.name = "Bob"
                user3.status = "inactive"
                await connection.manager.save(user3)

                // Get active users
                const activeUsers = connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.status = :status", { status: "active" })

                // Get users with specific names
                const specificUsers = connection
                    .createQueryBuilder(User, "user2")
                    .select("user2.name", "name")
                    .where("user2.name IN (:...names)", {
                        names: ["John", "Bob"],
                    })

                // INTERSECT should only return "John" (active AND in the list)
                const result = await activeUsers
                    .intersect(specificUsers)
                    .getRawMany()

                expect(result).to.have.lengthOf(1)
                expect(result[0].name).to.equal("John")
            }),
        ))

    it("should handle empty INTERSECT result", () =>
        Promise.all(
            connections.map(async (connection) => {
                // Skip if INTERSECT is not supported
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
                user1.name = "Alice"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "Bob"
                user2.status = "inactive"
                await connection.manager.save(user2)

                // No overlap between active and inactive users
                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.status = :status", { status: "active" })
                    .intersect(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.status = :status2", {
                                status2: "inactive",
                            }),
                    )
                    .getRawMany()

                expect(result).to.have.lengthOf(0)
            }),
        ))
})
