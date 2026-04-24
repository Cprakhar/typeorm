import "reflect-metadata"
import type { DataSource } from "../../../../src/data-source/DataSource"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { expect } from "chai"
import { Post } from "./entity/Post"
import { User } from "./entity/User"
import { Category } from "./entity/Category"
import { Person } from "./entity/Person"
import { Question } from "./entity/Question"
import { Answer } from "./entity/Answer"
import { DriverUtils } from "../../../../src/driver/DriverUtils"
import type { DatabaseType } from "../../../../src"

function getParameterPlaceholder(dataSource: DataSource): string | undefined {
    const driverType = dataSource.driver.options.type

    if (DriverUtils.isPostgresFamily(dataSource.driver)) return "$1"
    if (driverType === "mssql") return "@0"
    if (driverType === "sap") return "?"
    if (DriverUtils.isMySQLFamily(dataSource.driver)) return "?"

    return undefined
}

function getExpectedSqlByDriver(
    dataSource: DataSource,
    expected: {
        postgres?: string
        mssql?: string
        sap?: string
        mysql?: string
    },
): string | undefined {
    const driverType = dataSource.driver.options.type

    if (
        DriverUtils.isPostgresFamily(dataSource.driver) &&
        expected.postgres !== undefined
    ) {
        return expected.postgres
    }
    if (driverType === "mssql" && expected.mssql !== undefined) {
        return expected.mssql
    }
    if (driverType === "sap" && expected.sap !== undefined) {
        return expected.sap
    }
    if (
        DriverUtils.isMySQLFamily(dataSource.driver) &&
        expected.mysql !== undefined
    ) {
        return expected.mysql
    }

    return undefined
}

function expectSqlByDriver(
    dataSource: DataSource,
    sql: string,
    expected: {
        parameterized?: string
        postgres?: string
        mssql?: string
        sap?: string
        mysql?: string
    },
) {
    const parameterPlaceholder = getParameterPlaceholder(dataSource)

    if (
        expected.parameterized !== undefined &&
        parameterPlaceholder !== undefined
    ) {
        sql.should.be.equal(
            expected.parameterized.replaceAll(":param", parameterPlaceholder),
        )
        return
    }

    const expectedSql = getExpectedSqlByDriver(dataSource, expected)
    if (expectedSql !== undefined) sql.should.be.equal(expectedSql)
}

describe("multi-schema-and-database > basic-functionality", () => {
    describe("custom-table-schema-and-database", () => {
        let dataSources: DataSource[]
        before(async function () {
            dataSources = await createTestingConnections({
                entities: [Question, Answer],
                enabledDrivers: ["mssql"],
            })
            if (!dataSources.length) this.skip()
        })
        beforeEach(() => reloadTestingDatabases(dataSources))
        after(() => closeTestingConnections(dataSources))

        it("should set the table database / schema", () =>
            Promise.all(
                dataSources.map(async (dataSource) => {
                    const queryRunner = dataSource.createQueryRunner()
                    const table = (await queryRunner.getTable(
                        "testDB.questions.question",
                    ))!
                    await queryRunner.release()

                    expect(table.database).to.be.equal("testDB")
                    expect(table.schema).to.be.equal("questions")
                    expect(table.name).to.be.equal("testDB.questions.question")
                }),
            ))

        it("should correctly get the table primary keys when custom table schema used", () =>
            Promise.all(
                dataSources.map(async (dataSource) => {
                    const queryRunner = dataSource.createQueryRunner()
                    const table = (await queryRunner.getTable(
                        "testDB.questions.question",
                    ))!
                    await queryRunner.release()

                    expect(table.primaryColumns).to.have.length(1)
                    expect(table.findColumnByName("id")?.isGenerated).to.be.true
                }),
            ))

        it("should correctly create tables when custom database and custom schema used in Entity decorator", () =>
            Promise.all(
                dataSources.map(async (dataSource) => {
                    const queryRunner = dataSource.createQueryRunner()
                    const table = await queryRunner.getTable(
                        "testDB.questions.question",
                    )
                    await queryRunner.release()

                    const question = new Question()
                    question.name = "Question #1"
                    await dataSource.getRepository(Question).save(question)

                    const sql = dataSource
                        .createQueryBuilder(Question, "question")
                        .where("question.id = :id", { id: 1 })
                        .getSql()

                    sql.should.be.equal(
                        `SELECT "question"."id" AS "question_id", "question"."name" AS "question_name" FROM "testDB"."questions"."question" "question" WHERE "question"."id" = @0`,
                    )
                    table!.name.should.be.equal("testDB.questions.question")
                }),
            ))

        it("should correctly work with cross-schema and cross-database queries in QueryBuilder", () =>
            Promise.all(
                dataSources.map(async (dataSource) => {
                    const queryRunner = dataSource.createQueryRunner()
                    const questionTable = await queryRunner.getTable(
                        "testDB.questions.question",
                    )
                    const answerTable = await queryRunner.getTable(
                        "secondDB.answers.answer",
                    )
                    await queryRunner.release()

                    const question = new Question()
                    question.name = "Question #1"
                    await dataSource.getRepository(Question).save(question)

                    const answer1 = new Answer()
                    answer1.text = "answer 1"
                    answer1.questionId = question.id
                    await dataSource.getRepository(Answer).save(answer1)

                    const answer2 = new Answer()
                    answer2.text = "answer 2"
                    answer2.questionId = question.id
                    await dataSource.getRepository(Answer).save(answer2)

                    const query = dataSource
                        .createQueryBuilder()
                        .select()
                        .from(Question, "question")
                        .addFrom(Answer, "answer")
                        .where("question.id = :id", { id: 1 })
                        .andWhere("answer.questionId = question.id")

                    expect(await query.getRawOne()).to.be.not.empty

                    query
                        .getSql()
                        .should.be.equal(
                            `SELECT * FROM "testDB"."questions"."question" "question", "secondDB"."answers"."answer"` +
                                ` "answer" WHERE "question"."id" = @0 AND "answer"."questionId" = "question"."id"`,
                        )

                    questionTable!.name.should.be.equal(
                        "testDB.questions.question",
                    )
                    answerTable!.name.should.be.equal("secondDB.answers.answer")
                }),
            ))
    })

    describe("custom-database", () => {
        let dataSources: DataSource[]
        before(async function () {
            dataSources = await createTestingConnections({
                entities: [Person],
                enabledDrivers: ["mssql", "mysql"],
            })
            if (!dataSources.length) this.skip()
        })
        beforeEach(() => reloadTestingDatabases(dataSources))
        after(() => closeTestingConnections(dataSources))

        it("should correctly create tables when custom database used in Entity decorator", () =>
            Promise.all(
                dataSources.map(async (dataSource) => {
                    const queryRunner = dataSource.createQueryRunner()
                    const tablePath =
                        dataSource.driver.options.type === "mssql"
                            ? "secondDB..person"
                            : "secondDB.person"
                    const table = await queryRunner.getTable(tablePath)
                    await queryRunner.release()

                    const person = new Person()
                    person.name = "Person #1"
                    await dataSource.getRepository(Person).save(person)

                    const sql = dataSource
                        .createQueryBuilder(Person, "person")
                        .where("person.id = :id", { id: 1 })
                        .getSql()

                    expectSqlByDriver(dataSource, sql, {
                        mssql: `SELECT "person"."id" AS "person_id", "person"."name" AS "person_name" FROM "secondDB".."person" "person" WHERE "person"."id" = @0`,
                        mysql: "SELECT `person`.`id` AS `person_id`, `person`.`name` AS `person_name` FROM `secondDB`.`person` `person` WHERE `person`.`id` = ?",
                    })

                    table!.name.should.be.equal(tablePath)
                }),
            ))
    })

    describe("custom-table-schema", () => {
        const drivers: DatabaseType[][] = [
            // SAP throws error during connection if schema specified in connection options does not exist.
            // only testing custom schema specified in Entity decorator
            ["sap"],
            ["mssql", "postgres", "cockroachdb"],
        ]
        for (const driver of drivers) {
            describe(`${driver.join("|")}`, () => {
                let dataSources: DataSource[]
                before(async function () {
                    dataSources = await createTestingConnections({
                        entities: [User, Category, Post],
                        enabledDrivers: driver,
                        schema: driver.includes("sap") ? undefined : "custom",
                    })
                    if (!dataSources.length) this.skip()
                })
                beforeEach(() => reloadTestingDatabases(dataSources))
                after(() => closeTestingConnections(dataSources))

                it("should set the table database / schema", function () {
                    if (driver.includes("sap")) this.skip()

                    return Promise.all(
                        dataSources.map(async (dataSource) => {
                            const queryRunner = dataSource.createQueryRunner()
                            try {
                                const table =
                                    (await queryRunner.getTable("post"))!

                                expect(table.database).to.not.be.undefined
                                expect(table.schema).to.be.equal("custom")
                            } finally {
                                await queryRunner.release()
                            }
                        }),
                    )
                })

                it("should correctly get the table primary keys when custom table schema used", () =>
                    Promise.all(
                        dataSources.map(async (dataSource) => {
                            const queryRunner = dataSource.createQueryRunner()
                            try {
                                const table =
                                    (await queryRunner.getTable("post"))!

                                expect(table.primaryColumns).to.have.length(1)
                                expect(
                                    table.findColumnByName("id")?.isGenerated,
                                ).to.be.true
                            } finally {
                                await queryRunner.release()
                            }
                        }),
                    ))

                it("should correctly create tables when custom table schema used", function () {
                    if (driver.includes("sap")) this.skip()

                    return Promise.all(
                        dataSources.map(async (dataSource) => {
                            const queryRunner = dataSource.createQueryRunner()
                            try {
                                const table = await queryRunner.getTable("post")

                                const post = new Post()
                                post.name = "Post #1"
                                await dataSource.getRepository(Post).save(post)

                                const sql = dataSource
                                    .createQueryBuilder(Post, "post")
                                    .where("post.id = :id", { id: 1 })
                                    .getSql()

                                expectSqlByDriver(dataSource, sql, {
                                    parameterized: `SELECT "post"."id" AS "post_id", "post"."name" AS "post_name" FROM "custom"."post" "post" WHERE "post"."id" = :param`,
                                })

                                table!.name.should.be.equal("custom.post")
                            } finally {
                                await queryRunner.release()
                            }
                        }),
                    )
                })

                it("should correctly create tables when custom table schema used in Entity decorator", () =>
                    Promise.all(
                        dataSources.map(async (dataSource) => {
                            const queryRunner = dataSource.createQueryRunner()
                            try {
                                const table =
                                    await queryRunner.getTable(
                                        "userSchema.user",
                                    )

                                const user = new User()
                                user.name = "User #1"
                                await dataSource.getRepository(User).save(user)

                                const sql = dataSource
                                    .createQueryBuilder(User, "user")
                                    .where("user.id = :id", { id: 1 })
                                    .getSql()

                                expectSqlByDriver(dataSource, sql, {
                                    parameterized: `SELECT "user"."id" AS "user_id", "user"."name" AS "user_name" FROM "userSchema"."user" "user" WHERE "user"."id" = :param`,
                                })

                                table!.name.should.be.equal("userSchema.user")
                            } finally {
                                await queryRunner.release()
                            }
                        }),
                    ))

                it("should correctly work with cross-schema queries", () =>
                    Promise.all(
                        dataSources.map(async (dataSource) => {
                            const queryRunner = dataSource.createQueryRunner()
                            try {
                                const table =
                                    await queryRunner.getTable("guest.category")

                                const post = new Post()
                                post.name = "Post #1"
                                await dataSource.getRepository(Post).save(post)

                                const category = new Category()
                                category.name = "Category #1"
                                category.post = post
                                await dataSource
                                    .getRepository(Category)
                                    .save(category)

                                const loadedCategory = await dataSource
                                    .createQueryBuilder(Category, "category")
                                    .innerJoinAndSelect("category.post", "post")
                                    .where("category.id = :id", { id: 1 })
                                    .getOne()

                                loadedCategory!.should.be.not.empty
                                loadedCategory!.post.should.be.not.empty
                                loadedCategory!.post.id.should.be.equal(1)

                                const sql = dataSource
                                    .createQueryBuilder(Category, "category")
                                    .innerJoinAndSelect("category.post", "post")
                                    .where("category.id = :id", { id: 1 })
                                    .getSql()

                                expectSqlByDriver(dataSource, sql, {
                                    parameterized:
                                        `SELECT "category"."id" AS "category_id", "category"."name" AS "category_name",` +
                                        ` "category"."postId" AS "category_postId", "post"."id" AS "post_id", "post"."name" AS "post_name"` +
                                        ` FROM "guest"."category" "category" INNER JOIN ${driver.includes("sap") ? "" : '"custom".'}"post" "post" ON "post"."id"="category"."postId" WHERE "category"."id" = :param`,
                                })

                                table!.name.should.be.equal("guest.category")
                            } finally {
                                await queryRunner.release()
                            }
                        }),
                    ))

                it("should correctly work with QueryBuilder", () =>
                    Promise.all(
                        dataSources.map(async (dataSource) => {
                            const post = new Post()
                            post.name = "Post #1"
                            await dataSource.getRepository(Post).save(post)

                            const user = new User()
                            user.name = "User #1"
                            await dataSource.getRepository(User).save(user)

                            const category = new Category()
                            category.name = "Category #1"
                            category.post = post
                            await dataSource
                                .getRepository(Category)
                                .save(category)

                            const query = dataSource
                                .createQueryBuilder()
                                .select()
                                .from(Category, "category")
                                .addFrom(User, "user")
                                .addFrom(Post, "post")
                                .where("category.id = :id", { id: 1 })
                                .andWhere("post.id = category.post")

                            ;(await query.getRawOne())!.should.be.not.empty

                            expectSqlByDriver(dataSource, query.getSql(), {
                                parameterized:
                                    `SELECT * FROM "guest"."category" "category", "userSchema"."user" "user",` +
                                    ` ${driver.includes("sap") ? "" : '"custom".'}"post" "post" WHERE "category"."id" = :param AND "post"."id" = "category"."postId"`,
                            })
                        }),
                    ))
            })
        }
    })
})
