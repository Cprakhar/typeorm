# Set Operations (UNION, INTERSECT, EXCEPT) Examples

This document provides examples of using SQL set operations in TypeORM's QueryBuilder.

## UNION

Combines results from two or more queries, removing duplicates by default.

### Basic UNION

```typescript
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.name", "name")
    .addSelect("user.email", "email")
    .where("user.status = :status", { status: "active" })
    .union(
        dataSource
            .createQueryBuilder(Admin, "admin")
            .select("admin.fullName", "name")
            .addSelect("admin.email", "email")
    )
    .getRawMany()
```

### UNION ALL (Keep Duplicates)

```typescript
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.id", "id")
    .unionAll(
        dataSource
            .createQueryBuilder(Admin, "admin")
            .select("admin.id", "id")
    )
    .getRawMany()
```

### Chained UNION Operations

```typescript
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.name")
    .union(
        dataSource
            .createQueryBuilder(Admin, "admin")
            .select("admin.name")
    )
    .union(
        dataSource
            .createQueryBuilder(Guest, "guest")
            .select("guest.name")
    )
    .orderBy("name", "ASC")
    .getRawMany()
```

## INTERSECT

Returns only rows that appear in both queries.

### Basic INTERSECT

```typescript
// Find users who are both active AND in a specific group
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.id", "id")
    .where("user.status = :status", { status: "active" })
    .intersect(
        dataSource
            .createQueryBuilder(GroupMember, "member")
            .select("member.userId", "id")
            .where("member.groupId = :groupId", { groupId: 5 })
    )
    .getRawMany()
```

**Database Support:**
- PostgreSQL: ✅ All versions
- SQLite: ✅ All versions
- SQL Server: ✅ All versions
- Oracle: ✅ All versions
- MySQL: ⚠️ Version 8.0.31+
- MariaDB: ⚠️ Version 10.3+

## EXCEPT

Returns rows from the first query that don't appear in the second query.

### Basic EXCEPT

```typescript
// Find all users EXCEPT admins
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.email", "email")
    .except(
        dataSource
            .createQueryBuilder(Admin, "admin")
            .select("admin.email", "email")
    )
    .getRawMany()
```

### Oracle (Uses MINUS)

TypeORM automatically converts EXCEPT to MINUS for Oracle databases:

```typescript
// This works seamlessly on Oracle
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.id")
    .except(
        dataSource
            .createQueryBuilder(DeletedUser, "deleted")
            .select("deleted.userId")
    )
    .getRawMany()
// Generates: SELECT ... MINUS SELECT ... (on Oracle)
```

**Database Support:**
- PostgreSQL: ✅ All versions
- SQLite: ✅ All versions
- SQL Server: ✅ All versions
- Oracle: ✅ All versions (as MINUS)
- MySQL: ❌ Not supported
- MariaDB: ⚠️ Version 10.3+

## Advanced Examples

### With ORDER BY and LIMIT

```typescript
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.name", "name")
    .union(
        dataSource
            .createQueryBuilder(Admin, "admin")
            .select("admin.fullName", "name")
    )
    .orderBy("name", "DESC")
    .limit(10)
    .getRawMany()
```

### With Parameters

```typescript
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.email")
    .where("user.createdAt > :date1", { date1: new Date("2024-01-01") })
    .union(
        dataSource
            .createQueryBuilder(User, "user2")
            .select("user2.email")
            .where("user2.status = :status", { status: "vip" })
    )
    .getRawMany()
```

### Complex Chaining

```typescript
// (Active users UNION Admins) EXCEPT Banned users
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.id", "id")
    .where("user.status = 'active'")
    .union(
        dataSource
            .createQueryBuilder(Admin, "admin")
            .select("admin.userId", "id")
    )
    .except(
        dataSource
            .createQueryBuilder(BannedUser, "banned")
            .select("banned.userId", "id")
    )
    .getRawMany()
```

## Important Notes

1. **Column Compatibility**: All queries in a set operation must have the same number of columns with compatible types
2. **Column Names**: Use aliases to ensure consistent column naming across queries
3. **DISTINCT vs ALL**: 
   - `union()`, `intersect()`, `except()` default to DISTINCT (remove duplicates)
   - Use `unionAll()`, `intersectAll()`, `exceptAll()` to keep duplicates
4. **ORDER BY/LIMIT**: Apply after all set operations to order/limit the final result
5. **Database Support**: Check compatibility matrix before using INTERSECT/EXCEPT

## Error Handling

If you try to use an unsupported operation on a database, you'll get a SQL error:

```typescript
// This will fail on MySQL < 8.0.31
const result = await dataSource
    .createQueryBuilder(User, "user")
    .select("user.id")
    .intersect(
        dataSource
            .createQueryBuilder(Admin, "admin")
            .select("admin.id")
    )
    .getRawMany()
// QueryFailedError: INTERSECT is not supported
```

## Best Practices

1. **Use proper aliases** for all selected columns
2. **Test cross-database** if your app supports multiple databases
3. **Consider performance** - set operations can be expensive on large datasets
4. **Use indexes** on columns involved in set operations
5. **Prefer UNION ALL** when you know there are no duplicates (it's faster)
