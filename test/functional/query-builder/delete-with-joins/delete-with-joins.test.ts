import "reflect-metadata"
import { expect } from "chai"
import { DataSource } from "../../../../src"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { User } from "./entity/User"
import { Post } from "./entity/Post"
import { Comment } from "./entity/Comment"

describe("query builder > delete with joins", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                entities: [__dirname + "/entity/*{.js,.ts}"],
                enabledDrivers: ["mysql"],
                schemaCreate: true,
                dropSchema: true,
            })),
    )
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    async function prepareData(connection: DataSource) {
        // Create users
        const user1 = await connection.manager.save(User, {
            name: "John",
            email: "john@example.com",
        })
        const user2 = await connection.manager.save(User, {
            name: "Jane",
            email: "jane@example.com",
        })
        const user3 = await connection.manager.save(User, {
            name: "Bob",
            email: "bob@example.com",
        })

        // Create posts
        await connection.manager.save(Post, {
            title: "Post #1",
            status: "published",
            userId: user1.id,
        })
        await connection.manager.save(Post, {
            title: "Post #2",
            status: "draft",
            userId: user1.id,
        })
        await connection.manager.save(Post, {
            title: "Post #3",
            status: "published",
            userId: user2.id,
        })
        await connection.manager.save(Post, {
            title: "Post #4",
            status: "archived",
            userId: user3.id,
        })

        await connection.manager.save(Comment, {
            text: "Great post!",
            user: user1,
        })
        await connection.manager.save(Comment, {
            text: "Very informative.",
            user: user1,
        })
        await connection.manager.save(Comment, {
            text: "Thanks for sharing.",
            user: user2,
        })
    }

    // Test: delete with INNER JOIN with any entity or table
    it("should delete users with INNER JOIN based on post status", () =>
        Promise.all(
            connections.map(async (connection) => {
                await prepareData(connection)

                // Delete users who have posts with status 'archived'
                const result = await connection
                    .createQueryBuilder()
                    .delete()
                    .from(User, "u")
                    .innerJoin(Post, "p", "u.id = p.userId")
                    .where("p.status = :status", { status: "archived" })
                    .execute()

                expect(result.affected).to.equal(1)

                // Verify user was deleted
                const users = await connection.manager.find(User)
                expect(users).to.have.lengthOf(2)
            }),
        ))

    // Test: delete with INNER JOIN with any entity or table
    it("should delete posts with INNER JOIN based on user email", () =>
        Promise.all(
            connections.map(async (connection) => {
                await prepareData(connection)

                // Delete posts from users with email containing 'john'
                const result = await connection
                    .createQueryBuilder()
                    .delete()
                    .from(Post, "p")
                    .leftJoin(User, "u", "p.userId = u.id")
                    .where("u.email LIKE :email", { email: "%john%" })
                    .execute()

                expect(result.affected).to.equal(2)

                // Verify posts were deleted
                const posts = await connection.manager.find(Post)
                expect(posts).to.have.lengthOf(2)
                expect(posts.find((p) => p.title === "Post #1")).to.not.exist
                expect(posts.find((p) => p.title === "Post #2")).to.not.exist
            }),
        ))

    // Test: delete with multiple JOINs with any entity or table
    it("should delete with multiple JOINs", () =>
        Promise.all(
            connections.map(async (connection) => {
                await prepareData(connection)

                // Delete users who have posts with status 'published' or 'draft'
                const result = await connection
                    .createQueryBuilder()
                    .delete()
                    .from(User, "u")
                    .innerJoin(Post, "p1", "u.id = p1.userId")
                    .innerJoin(Post, "p2", "u.id = p2.userId")
                    .where("p1.status = :status1", { status1: "published" })
                    .andWhere("p2.status = :status2", { status2: "draft" })
                    .execute()

                expect(result.affected).to.equal(1)

                // Verify user was deleted
                const users = await connection.manager.find(User)
                expect(users).to.have.lengthOf(2)
                expect(users.find((u) => u.name === "John")).to.not.exist
            }),
        ))

    // TODO: Enable this test after implementing delete with relation joins
    it.skip("should delete with relation JOINs", () =>
        Promise.all(
            connections.map(async (connection) => {
                await prepareData(connection)

                // Delete users who have comments with text 'Great post!'
                const result = await connection
                    .createQueryBuilder()
                    .delete()
                    .from(User, "u")
                    .innerJoin("u.comments", "c")
                    .where("c.text = :text", { text: "Great post!" })
                    .execute()

                expect(result.affected).to.equal(1)

                // Verify user was deleted
                const users = await connection.manager.find(User)
                expect(users).to.have.lengthOf(2)
                expect(users.find((u) => u.name === "John")).to.not.exist
            }),
        ))
})
