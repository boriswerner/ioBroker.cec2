/**
 *
 * cec2 adapter
 *
 * //native parameters will be in adapter.config
 *
 * Structure:
 *  create a "device" for every physical address we encounter.
 *      set name to OSD Name -> probably clean up old device if OSD Name != new OSD Name
 *      for device create states:
 *          * power
 *          * activeSource true/false (must set to false, if somebody else gets active.
 *          * vendorId
 *          * device class (derivce from logical address?)
 *          * lastKnownLogicalAddress
 *          * ...
 *          * some Information what works and what not? (like capabilities?)
 *          * some things dependent on device class
 *      for device create channel(s):
 *          * remote buttons -> with buttons for all possible remote buttons to be clicked.
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";


// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

//imports:
//const CEC = require("./lib/cec-functions");
import {CEC, CECMonitor} from "@senzil/cec-monitor";


class CEC2 extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'cec2',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));

        this.cec = {};
    }

    async pollPowerStates() {
        let status = await this.cec.SendCommand(null, CEC.LogicalAddress.TV, CEC.GIVE_DEVICE_POWER_STATUS, CECMonitor.EVENTS.REPORT_POWER_STATUS);
        this.log.debug("TV Power is " + status.data.str);

        setTimeout(this.pollPowerStates, this.config.pollInterval || 30000);
    }

    /**
     * initializes cec monitor
     * @param config
     */
    async setupCECMonitor(config) {
        this.cec = new CECMonitor(config.osdName, {
            debug: config.cecDebug,
            hdmiport: config.hdmiPort,
            processManaged: false, // if false -> will catch uncaught exceptions and exit process. Hm.
            recorder: config.type === "r",
            player: config.type === "p",
            tuner: config.type === "t",
            audio: config.type === "a",
            autorestart: true, //allows auto restart of cec-client.
            command_timeout: 3,
            user_control_hold_interval: config.userControlHoldInterval
        });

        await this.cec.WaitForReady();
        this.log.debug("CEC Monitor ready.");
        //let's see what is there: //TODO is this necessary? Does the package do this anyway?
        this.cec.WriteRawMessage("scan");

        if (config.pollPowerStates) {
            this.pollPowerStates();
        }
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('config osdName: ' + this.config.osdName);
        this.log.info('config type: ' + this.config.type);

        this.setupCECMonitor(this.config);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        // await this.setObjectAsync('testVariable', {
        //     type: 'state',
        //     common: {
        //         name: 'testVariable',
        //         type: 'boolean',
        //         role: 'indicator',
        //         read: true,
        //         write: true,
        //     },
        //     native: {},
        // });

        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');

        /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });
    }


    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new CEC2(options);
} else {
    // otherwise start the instance directly
    new CEC2();
}