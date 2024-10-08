import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, beginCell, toNano } from '@ton/core';
import { SubdomainManager } from '../wrappers/SubdomainManager';
import { compile } from '@ton/blueprint';
import { randomBytes } from 'crypto';
import { randomAddress } from '@ton/test-utils';

describe('Subdomain', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SubdomainManager');
    });

    let blockchain: Blockchain;
    let subdomainManager: SandboxContract<SubdomainManager>;
    let owner: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');

        subdomainManager = blockchain.openContract(
            SubdomainManager.createFromConfig(
                {
                    owner: owner.address,
                },
                code
            )
        );

        const deployResult = await subdomainManager.sendDeploy(owner.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            deploy: true,
            success: true,
        });
        expect(deployResult.transactions).toHaveTransaction({
            from: subdomainManager.address,
            to: owner.address,
            success: true,
        });
    });

    it('should deploy', async () => {});

    it('should update records by admin', async () => {
        const result = await subdomainManager.sendUpdate(
            owner.getSender(),
            toNano('0.05'),
            'test',
            1n,
            beginCell().storeUint(123, 64).endCell()
        );
        printTransactionFees(result.transactions);
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: subdomainManager.address,
            to: owner.address,
            success: true,
        });
    });

    it('should not update records not by admin', async () => {
        const wallet = await blockchain.treasury('wallet');
        const result = await subdomainManager.sendUpdate(
            wallet.getSender(),
            toNano('0.05'),
            'test',
            1n,
            beginCell().storeUint(123, 64).endCell()
        );
        expect(result.transactions).toHaveTransaction({
            from: wallet.address,
            to: subdomainManager.address,
            success: false,
        });
    });

    it('should set next resolver', async () => {
        const result = await subdomainManager.sendSetNextResolver(
            owner.getSender(),
            toNano('0.05'),
            'test',
            randomAddress()
        );
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
        const data = await subdomainManager.getAll();
        expect(data.get('test')).toBeDefined();
    });

    it('should set wallet', async () => {
        const result = await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'test', randomAddress());
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });

    });

    it('should set site', async () => {
        const result = await subdomainManager.sendSetSite(owner.getSender(), toNano('0.05'), 'test', randomBytes(32));
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
    });

    it('should set storage', async () => {
        const result = await subdomainManager.sendSetStorage(
            owner.getSender(),
            toNano('0.05'),
            'test',
            randomBytes(32)
        );
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
    });

    it('should set and get records for multiple subdomains', async () => {
        const addr1 = randomAddress();
        const addr2 = randomAddress();
        await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'test1', addr1);
        await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'test2', addr2);

        var [resolved, value] = await subdomainManager.getResolve(
            'test1',
            BigInt('0xe8d44050873dba865aa7c170ab4cce64d90839a34dcfd6cf71d14e0205443b1b')
        );
        expect(resolved).toEqual(48);
        expect(value.beginParse().skip(16).loadAddress()).toEqualAddress(addr1);

        [resolved, value] = await subdomainManager.getResolve(
            'test2',
            BigInt('0xe8d44050873dba865aa7c170ab4cce64d90839a34dcfd6cf71d14e0205443b1b')
        );
        expect(resolved).toEqual(48);
        expect(value.beginParse().skip(16).loadAddress()).toEqualAddress(addr2);
    });

    it('should set records for multiple subdomains with same prefixes', async () => {
        let result = await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'test', randomAddress());
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });

        result = await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'testtest', randomAddress());
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });

        result = await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'testab', randomAddress());
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
        const data = await subdomainManager.getAll();
        expect(data.size).toEqual(3);
    });

    it('should delete records', async ()=>{
        let result = await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'test', randomAddress());
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });

        const {transactions} = await subdomainManager.sendDelete(owner.getSender(), toNano('0.05'), 'test');
        printTransactionFees(transactions);
        expect(transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
        const data = await subdomainManager.getAll();
        expect(data.size).toEqual(0);
    })
    it('should delete one record', async ()=>{
        let result = await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'test', randomAddress());
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
        const {transactions} = await subdomainManager.sendSetWallet(owner.getSender(), toNano('0.05'), 'test', null);
        printTransactionFees(transactions);
        expect(transactions).toHaveTransaction({
            from: owner.address,
            to: subdomainManager.address,
            success: true,
        });
    })
});
