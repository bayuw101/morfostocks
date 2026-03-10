-- CreateTable
CREATE TABLE `Stock` (
    `symbol` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`symbol`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockLiner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockSymbol` VARCHAR(191) NOT NULL,
    `liner` VARCHAR(191) NOT NULL,
    `avgDailyTurnover` BIGINT NOT NULL,
    `daysSampled` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockLiner_stockSymbol_key`(`stockSymbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OHLC` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockSymbol` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `open` DOUBLE NOT NULL,
    `high` DOUBLE NOT NULL,
    `low` DOUBLE NOT NULL,
    `close` DOUBLE NOT NULL,
    `volume` BIGINT NOT NULL,
    `value` BIGINT NOT NULL,
    `frequency` INTEGER NOT NULL,
    `foreignBuy` BIGINT NOT NULL,
    `foreignSell` BIGINT NOT NULL,
    `netForeign` BIGINT NOT NULL,

    INDEX `OHLC_date_idx`(`date`),
    UNIQUE INDEX `OHLC_stockSymbol_date_key`(`stockSymbol`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fundamental` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockSymbol` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Fundamental_stockSymbol_key`(`stockSymbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Broker` (
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `permission` VARCHAR(191) NULL,
    `group` VARCHAR(191) NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrokerSummary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brokerCode` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `investorType` VARCHAR(191) NOT NULL DEFAULT 'Total',
    `value` BIGINT NOT NULL,
    `volume` BIGINT NOT NULL,
    `frequency` INTEGER NULL,
    `bandarDetector` JSON NOT NULL,

    UNIQUE INDEX `BrokerSummary_brokerCode_date_investorType_key`(`brokerCode`, `date`, `investorType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrokerTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brokerCode` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `stockSymbol` VARCHAR(191) NOT NULL,
    `investorType` VARCHAR(191) NOT NULL DEFAULT 'Total',
    `action` VARCHAR(191) NOT NULL,
    `volume` BIGINT NOT NULL,
    `value` BIGINT NOT NULL,
    `avgPrice` DOUBLE NOT NULL,

    INDEX `BrokerTransaction_brokerCode_idx`(`brokerCode`),
    INDEX `BrokerTransaction_stockSymbol_idx`(`stockSymbol`),
    INDEX `BrokerTransaction_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BidOffer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockSymbol` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `tiers` JSON NOT NULL,

    INDEX `BidOffer_date_idx`(`date`),
    UNIQUE INDEX `BidOffer_stockSymbol_date_key`(`stockSymbol`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ownership` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `stockSymbol` VARCHAR(191) NOT NULL,
    `investorName` VARCHAR(191) NOT NULL,
    `investorType` VARCHAR(191) NOT NULL,
    `localForeign` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NOT NULL,
    `domicile` VARCHAR(191) NOT NULL,
    `scrip` BIGINT NOT NULL,
    `scripless` BIGINT NOT NULL,
    `total` BIGINT NOT NULL,
    `percentage` DOUBLE NOT NULL,

    INDEX `Ownership_stockSymbol_idx`(`stockSymbol`),
    INDEX `Ownership_date_idx`(`date`),
    UNIQUE INDEX `Ownership_date_stockSymbol_investorName_key`(`date`, `stockSymbol`, `investorName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OwnershipChange` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `stockSymbol` VARCHAR(191) NOT NULL,
    `investorName` VARCHAR(191) NOT NULL,
    `previousTotal` BIGINT NOT NULL,
    `newTotal` BIGINT NOT NULL,
    `changeTotal` BIGINT NOT NULL,
    `previousScrip` BIGINT NOT NULL DEFAULT 0,
    `newScrip` BIGINT NOT NULL DEFAULT 0,
    `changeScrip` BIGINT NOT NULL DEFAULT 0,
    `previousScripless` BIGINT NOT NULL DEFAULT 0,
    `newScripless` BIGINT NOT NULL DEFAULT 0,
    `changeScripless` BIGINT NOT NULL DEFAULT 0,
    `previousPct` DOUBLE NOT NULL,
    `newPct` DOUBLE NOT NULL,
    `changePct` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OwnershipChange_stockSymbol_idx`(`stockSymbol`),
    INDEX `OwnershipChange_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OwnershipSyncMeta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lastDate` DATETIME(3) NOT NULL,
    `lastPdfName` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OwnershipSyncMeta_lastPdfName_key`(`lastPdfName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockLiner` ADD CONSTRAINT `StockLiner_stockSymbol_fkey` FOREIGN KEY (`stockSymbol`) REFERENCES `Stock`(`symbol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OHLC` ADD CONSTRAINT `OHLC_stockSymbol_fkey` FOREIGN KEY (`stockSymbol`) REFERENCES `Stock`(`symbol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fundamental` ADD CONSTRAINT `Fundamental_stockSymbol_fkey` FOREIGN KEY (`stockSymbol`) REFERENCES `Stock`(`symbol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrokerSummary` ADD CONSTRAINT `BrokerSummary_brokerCode_fkey` FOREIGN KEY (`brokerCode`) REFERENCES `Broker`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrokerTransaction` ADD CONSTRAINT `BrokerTransaction_brokerCode_fkey` FOREIGN KEY (`brokerCode`) REFERENCES `Broker`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BidOffer` ADD CONSTRAINT `BidOffer_stockSymbol_fkey` FOREIGN KEY (`stockSymbol`) REFERENCES `Stock`(`symbol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ownership` ADD CONSTRAINT `Ownership_stockSymbol_fkey` FOREIGN KEY (`stockSymbol`) REFERENCES `Stock`(`symbol`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnershipChange` ADD CONSTRAINT `OwnershipChange_stockSymbol_fkey` FOREIGN KEY (`stockSymbol`) REFERENCES `Stock`(`symbol`) ON DELETE RESTRICT ON UPDATE CASCADE;
