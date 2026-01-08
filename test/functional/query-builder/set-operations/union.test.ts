import "reflect-metadata"
import { expect } from "chai"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { DataSource } from "../../../../src/data-source/DataSource"
import { User } from "./entity/User"
import { Admin } from "./entity/Admin"

describe("query builder > set operations > union", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                entities: [__dirname + "/entity/*{.js,.ts}"],
                schemaCreate: true,
                dropSchema: true,
            })),
    )
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    it("should perform basic UNION operation", () =>
        Promise.all(
            connections.map(async (connection) => {
                // Insert test data
                const user1 = new User()
                user1.name = "John"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "Jane"
                user2.status = "inactive"
                await connection.manager.save(user2)

                const admin1 = new Admin()
                admin1.fullName = "Admin One"
                admin1.role = "superadmin"
                await connection.manager.save(admin1)

                // Perform UNION query
                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .addSelect("user.status", "role")
                    .where("user.status = :status", { status: "active" })
                    .union(
                        connection
                            .createQueryBuilder(Admin, "admin")
                            .select("admin.fullName", "name")
                            .addSelect("admin.role", "role"),
                    )
                    .getRawMany()

                expect(result).to.have.lengthOf(2)
                const names = result.map((r) => r.name).sort()
                expect(names).to.include.members(["Admin One", "John"])
            }),
        ))

    it("should perform UNION ALL operation", () =>
        Promise.all(
            connections.map(async (connection) => {
                // Insert duplicate data
                const user1 = new User()
                user1.name = "Duplicate"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "Duplicate"
                user2.status = "active"
                await connection.manager.save(user2)

                // UNION should deduplicate
                const unionResult = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.id = :id1", { id1: user1.id })
                    .union(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.id = :id2", { id2: user2.id }),
                    )
                    .getRawMany()

                // UNION ALL should keep duplicates
                const unionAllResult = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.id = :id1", { id1: user1.id })
                    .unionAll(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.id = :id2", { id2: user2.id }),
                    )
                    .getRawMany()

                expect(unionResult).to.have.lengthOf(1)
                expect(unionAllResult).to.have.lengthOf(2)
            }),
        ))

    it("should handle multiple UNION operations", () =>
        Promise.all(
            connections.map(async (connection) => {
                const user1 = new User()
                user1.name = "User1"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "User2"
                user2.status = "inactive"
                await connection.manager.save(user2)

                const admin1 = new Admin()
                admin1.fullName = "Admin1"
                admin1.role = "admin"
                await connection.manager.save(admin1)

                // Chain multiple UNIONs
                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.id = :id1", { id1: user1.id })
                    .union(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.id = :id2", { id2: user2.id }),
                    )
                    .union(
                        connection
                            .createQueryBuilder(Admin, "admin")
                            .select("admin.fullName", "name"),
                    )
                    .getRawMany()

                expect(result).to.have.lengthOf(3)
                const names = result.map((r) => r.name).sort()
                expect(names).to.deep.equal(["Admin1", "User1", "User2"])
            }),
        ))

    it("should work with ORDER BY after UNION", () =>
        Promise.all(
            connections.map(async (connection) => {
                const user1 = new User()
                user1.name = "Zack"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "Alice"
                user2.status = "inactive"
                await connection.manager.save(user2)

                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.id = :id1", { id1: user1.id })
                    .union(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.id = :id2", { id2: user2.id }),
                    )
                    .orderBy("name", "ASC")
                    .getRawMany()

                expect(result).to.have.lengthOf(2)
                expect(result[0].name).to.equal("Alice")
                expect(result[1].name).to.equal("Zack")
            }),
        ))

    it("should work with LIMIT after UNION", () =>
        Promise.all(
            connections.map(async (connection) => {
                const user1 = new User()
                user1.name = "User1"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "User2"
                user2.status = "active"
                await connection.manager.save(user2)

                const user3 = new User()
                user3.name = "User3"
                user3.status = "inactive"
                await connection.manager.save(user3)

                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.status = :status", { status: "active" })
                    .union(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.status = :status2", {
                                status2: "inactive",
                            }),
                    )
                    .limit(2)
                    .getRawMany()

                expect(result).to.have.length.at.most(2)
            }),
        ))

    it("should handle parameters in UNION queries correctly", () =>
        Promise.all(
            connections.map(async (connection) => {
                const user1 = new User()
                user1.name = "Active User"
                user1.status = "active"
                await connection.manager.save(user1)

                const user2 = new User()
                user2.name = "Pending User"
                user2.status = "pending"
                await connection.manager.save(user2)

                const result = await connection
                    .createQueryBuilder(User, "user")
                    .select("user.name", "name")
                    .where("user.status = :status1", { status1: "active" })
                    .union(
                        connection
                            .createQueryBuilder(User, "user2")
                            .select("user2.name", "name")
                            .where("user2.status = :status2", {
                                status2: "pending",
                            }),
                    )
                    .getRawMany()

                expect(result).to.have.lengthOf(2)
                const names = result.map((r) => r.name).sort()
                expect(names).to.include.members([
                    "Active User",
                    "Pending User",
                ])
            }),
        ))
})
