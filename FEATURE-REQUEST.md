# Feature Request: Add support in QueryBuilder for `<UNION | INTERSECT | EXCEPT>[ALL | DISTINCT]` operations

## Summary

Enhance the QueryBuilder to support SQL set operations such as `UNION`, `INTERSECT`, and `EXCEPT`. This will allow developers to combine results from multiple queries seamlessly.
With `ALL` and `DISTINCT` options for set operations to provide more flexibility in result sets.

## Use Cases

1. Combining Results: Use `UNION` to merge results from different tables or queries into a single result set.
2. Filtering Data: Use `INTERSECT` to find common records between two queries.
3. Excluding Data: Use `EXCEPT` to filter out records present in another query.
4. Advanced Reporting: Generate complex reports that require data from multiple sources.

## Proposed API Changes

```typescript
const firstQuery = connection
    .getRepository(EntityA)
    .createQueryBuilder("a")
    .select(["a.id", "a.name"])

const secondQuery = connection
    .getRepository(EntityB)
    .createQueryBuilder("b")
    .select(["b.id", "b.name"])

const unionQuery = firstQuery.union(secondQuery, { distinct: true })
const intersectQuery = firstQuery.intersect(secondQuery)
const exceptQuery = firstQuery.except(secondQuery)
```

## Additional Considerations

- Ensure compatibility with different database systems that support these operations.
- Handle edge cases such as differing column counts and types between queries.
- Provide comprehensive documentation and examples for users.
- Implement thorough testing to ensure reliability and performance.
- Consider performance implications when using these operations on large datasets.
- Allow chaining of multiple set operations in a single query.
    - Example1:

        ```sql
        query1 UNION query2 INTERSECT query3 EXCEPT query4
        ```

        ```ts
        const combinedQuery = firstQuery
            .union(secondQuery)
            .intersect(thirdQuery)
            .except(fourthQuery)
        ```

    - Example2:

        ```sql
        (query1 UNION ALL query2) EXCEPT DISTINCT (query3 INTERSECT query4)
        ```

        ```ts
        const combinedQuery = firstQuery
            .unionAll(secondQuery)
            .exceptDistinct(thirdQuery.intersect(fourthQuery))
        ```

### Database Compatibility

- PostgreSQL/CockroachDB:
    - Supports
        - `UNION [ALL | DISTINCT]`
        - `INTERSECT [ALL | DISTINCT]`
        - `EXCEPT [ALL | DISTINCT]`
- MySQL:
    - Supports
        - `UNION [ALL | DISTINCT]`
        - `INTERSECT [ALL | DISTINCT]`
        - `EXCEPT [ALL | DISTINCT]`
- MariaDB:
    - Supports
        - `UNION [ALL | DISTINCT]`
        - `INTERSECT DISTINCT`
        - `EXCEPT DISTINCT`
        - `EXCEPT ALL` and `INTERSECT ALL` (from v10.5+)
        - `MINUS` as an alias for `EXCEPT` when `SQL_MODE = ORACLE` is enabled. // Priority very low
- SQL Server:
    - Supports
        - `UNION [ALL | DISTINCT]`
        - `INTERSECT`
        - `EXCEPT`
- Oracle:
    - Supports
        - `UNION [ALL | DISTINCT]`
        - `INTERSECT`
        - `MINUS` (equivalent to `EXCEPT`)

## Instructions for Copilot

When generating code for this feature request, please ensure that the implementation adheres to the proposed API changes and considers the additional considerations mentioned above. The code should be modular, maintainable, and well-documented to facilitate future enhancements and debugging.

- Need to split the complete implementation into multiple commit(s) if required.
- Each commit should have a clear and concise commit message that describes the changes made.
- Start with a single set operation (e.g., `UNION`) before implementing the others to ensure clarity and focus in each commit.
