-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discord_id` INTEGER NOT NULL,
    `handle` VARCHAR(255) NOT NULL,
    `class` INTEGER NOT NULL,
    `tier` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,
    `bio` TEXT NULL,
    `solved_count` INTEGER NOT NULL,
    `create_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_expired` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `User_discord_id_key`(`discord_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Problem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `level` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProblemHolder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `problem_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProblemHolder` ADD CONSTRAINT `ProblemHolder_problem_id_fkey` FOREIGN KEY (`problem_id`) REFERENCES `Problem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProblemHolder` ADD CONSTRAINT `ProblemHolder_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
