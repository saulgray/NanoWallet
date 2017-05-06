import CryptoHelpers from '../../utils/CryptoHelpers';
import Network from '../../utils/Network';
import helpers from '../../utils/helpers';
import KeyPair from '../../utils/KeyPair';
import Address from '../../utils/Address';

class SignupCtrl {
    constructor(AppConstants, $state, Alert, WalletBuilder, $localStorage, $timeout) {
        'ngInject';

        //Local storage
        this._storage = $localStorage;
        // Alert service
        this._Alert = Alert;
        // WalletBuilder service
        this._WalletBuilder = WalletBuilder;
        // $state for redirect
        this._$state = $state;
        // App constants
        this._AppConstants = AppConstants;
        // $timeout to digest asynchronously
        this._$timeout = $timeout;

        // Signup properties
        this.network = this._AppConstants.defaultNetwork;
        // Available networks
        this.networks = Network.data;
        // Get wallets from local storage or create empty array
        this._storage.wallets = this._storage.wallets || [];
        // Needed to prevent user to click twice on send when already processing
        this.okPressed = false;

        // Force users to confirm they have account keys safe
        this.haveWalletFile = false;
        this.havePrivateKeySaved = false;

        // Wallet data to show
        this.rawWallet = "";
        this.walletPrivateKey = "";

        this.formData = {};

        // Wallet types
        this.walletTypes = [{
            "type": 1 // Simple
        }, {
            "type": 2 // Brain
        }, {
            "type": 3 // Private key
        }];

        // Default is "create a new wallet" (PRNG)
        this._selectedType = this.walletTypes[0];
    }

    /**
     * changeWalletType() Change the selected wallet type
     *
     * @param type: Type number
     */
    changeWalletType(type) {
        // Set wallet type
        this._selectedType = this.walletTypes[type - 1];
    }

    /**
     * changeNetwork() Change wallet network
     *
     * @param network: Network id to use at wallet creation
     */
    changeNetwork(id) {
        if (id == Network.data.Mijin.id && this._AppConstants.mijinDisabled) {
            this._Alert.mijinDisabled();
            // Reset network to default
            this.network = this._AppConstants.defaultNetwork;
            return;
        } else if (id == Network.data.Mainnet.id && this._AppConstants.mainnetDisabled) {
            this._Alert.mainnetDisabled();
            // Reset network to default
            this.network = this._AppConstants.defaultNetwork;
            return;
        }
        // Set Network
        this.network = id;
    }

    /**
     * download() trigger download of the wallet
     *
     * @param wallet: Wallet object
     */
    download(wallet) {
        if (!wallet) {
            this._Alert.errorWalletDownload();
            return;
        }
        // Wallet object string to word array
        var wordArray = CryptoJS.enc.Utf8.parse(JSON.stringify(wallet));
        // Word array to base64
        var base64 = CryptoJS.enc.Base64.stringify(wordArray);
        // Set download element attributes
        $("#downloadWallet").attr('href', 'data:application/octet-stream,' + base64);
        $("#downloadWallet").attr('download', wallet.name + '.wlt');
        // Simulate click to trigger download
        document.getElementById("downloadWallet").click();
    }

    /**
     * createWallet() create a new PRNG wallet
     */
    createWallet() {
            // Check form
            if (!this.formData || !this.formData.walletName || !this.formData.password || !this.formData.confirmPassword) {
                this._Alert.missingFormData();
                return;
            }

            // Check if wallet already loaded
            if (helpers.haveWallet(this.formData.walletName, this._storage.wallets)) {
                this._Alert.walletNameExists();
                return;
            }

            // Check if passwords match
            if (this.formData.password !== this.formData.confirmPassword) {
                this._Alert.passwordsNotMatching();
                return;
            }

            this.okPressed = true;

                // Create the wallet from form data
                return this._WalletBuilder.createWallet(this.formData.walletName, this.formData.password, this.network).then((wallet) => {
                    this._$timeout(() => {
                        if (wallet) {
                            // On success concat new wallet to local storage wallets
                            this._storage.wallets = this._storage.wallets.concat(wallet);
                            this._Alert.createWalletSuccess();
                            // Trigger download
                            this.download(wallet);
                            // Set wallet data for view
                            this.rawWallet = this.encodeWallet(wallet);
                            // We need private key so we create a common object with the wallet password
                            let common = { "password": this.formData.password, "privateKey": "" };
                            // Decrypt account private key
                            if(!CryptoHelpers.passwordToPrivatekeyClear(common, wallet.accounts[0], wallet.accounts[0].algo, true)) {
                                this.walletPrivateKey = "Cannot get the private key..";
                            } else if (!CryptoHelpers.checkAddress(common.privateKey, wallet.accounts[0].network, wallet.accounts[0].address)) {
                                this._Alert.invalidPassword();
                                this.walletPrivateKey = "Wallet address does not correspond to decrypted private key..";
                                // Enable send button
                                this.okPressed = false;
                                return;
                            } else {
                                // Set the decrypted private key 
                                this.walletPrivateKey = common.privateKey;
                            }
                            // Unlock button
                            this.okPressed = false;
                            // Reset form data
                            this.formData = "";
                            // Open modal and force user to backup data
                            $('#safetyModal').modal({
                              backdrop: 'static',
                              keyboard: false
                            }); 
                        }
                    }, 10);
                },
                (err) => {
                    this._Alert.createWalletFailed(err);
                    this.okPressed = false;
                });
    }

    /**
     * createBrainWallet() create a new brain wallet
     */
    createBrainWallet() {
            // Check form
            if (!this.formData || !this.formData.walletName || !this.formData.password || !this.formData.confirmPassword) {
                this._Alert.missingFormData();
                return;
            }

            // Check if wallet already loaded
            if (helpers.haveWallet(this.formData.walletName, this._storage.wallets)) {
                this._Alert.walletNameExists();
                return;
            }

            // Check if passwords match
            if (this.formData.password !== this.formData.confirmPassword) {
                this._Alert.passwordsNotMatching();
                return;
            }

            this.okPressed = true;

                // Create the wallet from form data
                return this._WalletBuilder.createBrainWallet(this.formData.walletName, this.formData.password, this.network).then((wallet) => {
                    this._$timeout(() => {
                        if (wallet) {
                            // On success concat new wallet to local storage wallets
                            this._storage.wallets = this._storage.wallets.concat(wallet);
                            this._Alert.createWalletSuccess();
                            // Trigger download
                            this.download(wallet)
                            // Set wallet data for view
                            this.rawWallet = this.encodeWallet(wallet);
                            this.walletPrivateKey = CryptoHelpers.derivePassSha(this.formData.password, 6000).priv;
                            // Unlock button
                            this.okPressed = false;
                            // Reset form data
                            this.formData = "";
                            // Open modal and force user to backup data
                            $('#safetyModal').modal({
                              backdrop: 'static',
                              keyboard: false
                            }); 
                        }
                    }, 10);
                },
                (err) => {
                    this._Alert.createWalletFailed(err);
                    this.okPressed = false;
                });
    }

    /**
     * createPrivateKeyWallet() create a new private key wallet
     */
    createPrivateKeyWallet() {
            // Check form
            if (!this.formData || !this.formData.walletName || !this.formData.password || !this.formData.confirmPassword || !this.formData.privateKey) {
                this._Alert.missingFormData();
                return;
            }

            // Check if wallet already loaded
            if (helpers.haveWallet(this.formData.walletName, this._storage.wallets)) {
                this._Alert.walletNameExists();
                return;
            }

            // Check if passwords match
            if (this.formData.password !== this.formData.confirmPassword) {
                this._Alert.passwordsNotMatching();
                return;
            }

            if (this.formData.privateKey.length === 64 || this.formData.privateKey.length === 66) {

                let kp = KeyPair.create(this.formData.privateKey);
                this.formData.address = Address.toAddress(kp.publicKey.toString(), this.network);

                this.okPressed = true;

                // Create the wallet from form data
                return this._WalletBuilder.createPrivateKeyWallet(this.formData.walletName, this.formData.password, this.formData.address, this.formData.privateKey, this.network).then((wallet) => {
                    this._$timeout(() => {
                        if (wallet) {
                            // On success concat new wallet to local storage wallets
                            this._storage.wallets = this._storage.wallets.concat(wallet);
                            this._Alert.createWalletSuccess();
                            // Trigger download
                            this.download(wallet)
                            // Set wallet data for view
                            this.rawWallet = this.encodeWallet(wallet);
                            this.walletPrivateKey = this.formData.privateKey;
                            // Unlock button
                            this.okPressed = false;
                            // Reset form data
                            this.formData = "";
                            // Open modal and force user to backup data
                            $('#safetyModal').modal({
                              backdrop: 'static',
                              keyboard: false
                            }); 
                        }
                    }, 10);
                },
                (err) => {
                    this._Alert.createWalletFailed(err);
                    this.okPressed = false;
                });
            } else {
                this._Alert.invalidPrivateKey();
            }
    }

    generateAddress() {
        if(undefined !== this.formData.privateKey && this.formData.privateKey.length) {
            if (this.formData.privateKey.length === 64 || this.formData.privateKey.length === 66) {
                let kp = KeyPair.create(this.formData.privateKey);
                this.formData.address = Address.toAddress(kp.publicKey.toString(), this.network);
            } else {
                this.formData.address = "";
                this._Alert.invalidPrivateKey();
            }
        }
    }

    /**
     * Redirect to login page
     */
    redirect() {
        this._$state.go("app.login");
    }

    /**
     * Encode a wallet object to base 64
     */
    encodeWallet(wallet) {
        // Wallet object string to word array
        var wordArray = CryptoJS.enc.Utf8.parse(JSON.stringify(wallet));
        // Word array to base64
        return CryptoJS.enc.Base64.stringify(wordArray);
    }

}

export default SignupCtrl;