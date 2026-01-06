import {
    Check,
    Entity,
    Column,
    PrimaryGeneratedColumn,
} from "../../../../../../src"

@Entity("check_constraint_entity")
export class CheckConstraintEntityModified {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    @Check("age_check", "age >= 21") // Changed from 18 to 21
    age: number

    @Column()
    @Check("type_check", "type IN ('A', 'B', 'C', 'D')") // Added 'D'
    type: "A" | "B" | "C" | "D"

    @Column({ nullable: true })
    @Check("score_check", "score >= 0 AND score <= 150") // Changed from 100 to 150
    score: number
}
