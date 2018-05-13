DELETE FROM AddressChanges WHERE Height > 150000

DELETE FROM BlockInfo WHERE Height > 150000

DELETE FROM BlockTransactions WHERE Height > 150000

DELETE FROM TxInfo WHERE Height > 150000

DELETE FROM HostAnnInfo WHERE Height > 150000

DELETE FROM ContractInfo WHERE Height > 150000

DELETE FROM RevisionsInfo WHERE Height > 150000

DELETE FROM ContractResolutions WHERE Height > 150000