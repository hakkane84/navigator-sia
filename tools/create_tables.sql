USE [navigator]
GO

/****** Object:  Table [dbo].[AddressChanges]    Script Date: 5/1/2018 9:04:33 PM ******/
/****** Add indexes on: Address, MasterHash and Height ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AddressChanges](
	[Address] [char](76) NOT NULL,
	[MasterHash] [char](64) NULL,
	[ScChange] [numeric](36, 0) NULL,
	[SfChange] [smallint] NULL,
	[Height] [int] NULL,
	[Timestamp] [bigint] NULL,
	[TxType] [varchar](15) NULL
) ON [PRIMARY]
GO



USE [navigator]
GO

/****** Object:  Table [dbo].[BlockInfo]    Script Date: 5/1/2018 9:13:20 PM ******/
/****** Add indexes on: Height ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BlockInfo](
	[Height] [int] NOT NULL,
	[Timestamp] [bigint] NULL,
	[TransactionCount] [bigint] NULL,
	[Hash] [char](64) NULL,
	[MinerPayoutAddress] [char](76) NULL,
	[MinerArbitraryData] [varchar](max) NULL,
	[Difficulty] [numeric](30, 0) NULL,
	[Hashrate] [numeric](30, 0) NULL,
	[TotalCoins] [numeric](36, 0) NULL,
	[SiacoinInputCount] [bigint] NULL,
	[SiacoinOutputCount] [bigint] NULL,
	[FileContractRevisionCount] [bigint] NULL,
	[StorageProofCount] [bigint] NULL,
	[SiafundInputCount] [smallint] NULL,
	[SiafundOutputCount] [smallint] NULL,
	[ActiveContractCost] [numeric](36, 0) NULL,
	[ActiveContractCount] [int] NULL,
	[ActiveContractSize] [numeric](24, 0) NULL,
	[TotalContractCost] [numeric](36, 0) NULL,
	[TotalContractCount] [bigint] NULL,
	[TotalContractSize] [numeric](30, 0) NULL,
	[NewContracts] [smallint] NULL,
	[NewTx] [smallint] NULL,
 CONSTRAINT [PK_BlockInfo] PRIMARY KEY CLUSTERED 
(
	[Height] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO


USE [navigator]
GO

/****** Object:  Table [dbo].[BlockTransactions]    Script Date: 5/1/2018 9:15:05 PM ******/
/****** Add indexes on: Height and TxHash ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BlockTransactions](
	[Height] [char](64) NULL,
	[TxHash] [char](64) NOT NULL,
	[TxType] [varchar](15) NULL,
	[TotalAmountSc] [numeric](36, 0) NULL,
	[TotalAmountSf] [smallint] NULL,
 CONSTRAINT [PK_BlockTransactions2] PRIMARY KEY CLUSTERED 
(
	[TxHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO



USE [navigator]
GO

/****** Object:  Table [dbo].[ContractInfo]    Script Date: 5/1/2018 9:16:54 PM ******/
/****** Add indexes on: Height, ContractId and MasterHash ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ContractInfo](
	[MasterHash] [char](64) NOT NULL,
	[ContractId] [char](64) NULL,
	[AllowancePosting] [char](76) NULL,
	[RenterValue] [numeric](36, 0) NULL,
	[CollateralPosting] [char](76) NULL,
	[HostValue] [numeric](36, 0) NULL,
	[Fees] [numeric](36, 0) NULL,
	[WindowStart] [int] NULL,
	[WindowEnd] [int] NULL,
	[RevisionNum] [int] NULL,
	[OriginalFileSize] [numeric](24, 0) NULL,
	[CurrentFileSize] [numeric](24, 0) NULL,
	[ValidProof1Address] [char](76) NULL,
	[ValidProof1Value] [numeric](36, 0) NULL,
	[ValidProof2Address] [char](76) NULL,
	[ValidProof2Value] [numeric](36, 0) NULL,
	[MissedProof1Address] [char](76) NULL,
	[MissedProof1Value] [numeric](36, 0) NULL,
	[MissedProof2Address] [char](76) NULL,
	[MissedProof2Value] [numeric](36, 0) NULL,
	[MissedProof3Address] [char](76) NULL,
	[MissedProof3Value] [numeric](36, 0) NULL,
	[Height] [int] NULL,
	[Timestamp] [bigint] NULL,
	[Status] [varchar](15) NULL,
	[Renew] [bit] NULL,
 CONSTRAINT [PK_ContractInfo] PRIMARY KEY CLUSTERED 
(
	[MasterHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO



USE [navigator]
GO

/****** Object:  Table [dbo].[ContractResolutions]    Script Date: 5/1/2018 9:17:54 PM ******/
/****** Add indexes on: Height, ContractId and MasterHash ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ContractResolutions](
	[MasterHash] [char](64) NOT NULL,
	[ContractId] [char](64) NULL,
	[Fees] [numeric](36, 0) NULL,
	[Result] [varchar](15) NULL,
	[Height] [int] NULL,
	[Timestamp] [bigint] NULL,
	[Output0Address] [char](76) NULL,
	[Output0Value] [numeric](36, 0) NULL,
	[Output1Address] [char](76) NULL,
	[Output1Value] [numeric](36, 0) NULL,
	[Output2Address] [char](76) NULL,
	[Output2Value] [numeric](36, 0) NULL,
	[ProofPostingHash] [char](64) NULL,
	[Synonyms] [varchar](max) NULL,
 CONSTRAINT [PK_ContractResolutions] PRIMARY KEY CLUSTERED 
(
	[MasterHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO



USE [navigator]
GO

/****** Object:  Table [dbo].[HashTypes]    Script Date: 5/1/2018 9:19:11 PM ******/
/****** Add indexes on: Hash ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[HashTypes](
	[Hash] [varchar](76) NOT NULL,
	[Type] [varchar](15) NULL,
	[Masterhash] [char](76) NULL
) ON [PRIMARY]
GO



USE [navigator]
GO

/****** Object:  Table [dbo].[HostAnnInfo]    Script Date: 5/1/2018 9:20:45 PM ******/
/****** Add indexes on: TxHash and Height ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[HostAnnInfo](
	[TxHash] [char](64) NOT NULL,
	[HashSynonyms] [varchar](max) NULL,
	[Height] [int] NULL,
	[Timestamp] [bigint] NULL,
	[Fees] [numeric](36, 0) NULL,
	[IP] [varchar](max) NULL,
 CONSTRAINT [PK_HostAnnInfo] PRIMARY KEY CLUSTERED 
(
	[TxHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO



USE [navigator]
GO

/****** Object:  Table [dbo].[RevisionsInfo]    Script Date: 5/1/2018 9:21:51 PM ******/
/****** Add indexes on: MasterHash, ContractId and Height ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[RevisionsInfo](
	[MasterHash] [char](64) NOT NULL,
	[ContractId] [char](64) NULL,
	[Fees] [numeric](36, 0) NULL,
	[NewRevisionNum] [int] NULL,
	[NewFileSize] [numeric](24, 0) NULL,
	[ValidProof1Address] [char](76) NULL,
	[ValidProof1Value] [numeric](36, 0) NULL,
	[ValidProof2Address] [char](76) NULL,
	[ValidProof2Value] [numeric](36, 0) NULL,
	[MissedProof1Address] [char](76) NULL,
	[MissedProof1Value] [numeric](36, 0) NULL,
	[MissedProof2Address] [char](76) NULL,
	[MissedProof2Value] [numeric](36, 0) NULL,
	[MissedProof3Address] [char](76) NULL,
	[MissedProof3Value] [numeric](36, 0) NULL,
	[Height] [int] NULL,
	[Timestamp] [bigint] NULL,
	[HashSynonyms] [varchar](max) NULL,
 CONSTRAINT [PK_RevisionsInfo] PRIMARY KEY CLUSTERED 
(
	[MasterHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO



USE [navigator]
GO

/****** Object:  Table [dbo].[TxInfo]    Script Date: 5/1/2018 9:23:18 PM ******/
/****** Add indexes on: TxHash and Height ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[TxInfo](
	[TxHash] [char](64) NOT NULL,
	[HashSynonyms] [varchar](max) NULL,
	[Height] [int] NULL,
	[Timestamp] [bigint] NULL,
	[Fees] [numeric](36, 0) NULL,
 CONSTRAINT [PK_TxInfo] PRIMARY KEY CLUSTERED 
(
	[TxHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO


