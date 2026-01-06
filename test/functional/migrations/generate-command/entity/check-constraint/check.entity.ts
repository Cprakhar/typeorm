import {
    Check,
    Entity,
    Column,
    PrimaryGeneratedColumn,
} from "../../../../../../src"

@Entity("check_constraint_entity")
export class CheckConstraintEntity {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    @Check("age_check", "age >= 18")
    age: number

    @Column()
    @Check("type_check", "type IN ('A', 'B', 'C')")
    type: "A" | "B" | "C"

    @Column({ nullable: true })
    @Check("score_check", "score >= 0 AND score <= 100")
    score: number
}
