const fs = require("fs");
const request = require("request-promise");
const { Signale } = require("signale");
const config = require("./config");
const newLine = require("os").EOL;


class Task {
    constructor (config) {
        this.config = config;

        this.logger = new Signale({
        interactive: false,
        scope: "Task"
        });

        this.logger.config({
        displayTimestamp: true
        });

        this.headers = {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        Host: "www.supremenewyork.com",
        Pragma: "no-cache",
        "User-Agent":
            "Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL Build/OPD1.170816.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://www.supremenewyork.com"
        };
    }

    async Start () {
        await this.checkWeek();
        const opts = {
            url: "https://www.supremenewyork.com/shop.json",
            method: "GET",
            headers: this.headers,
            agentOptions: { secureProtocol: "TLSv1_2_method" },
            gzip: true,
            json: true
        };

        if (this.config.proxies["useProxies"]) opts["proxy"] = this.getProxy();

        try {
            let resp = await request(opts);
            resp = resp["products_and_categories"];
            const newCategory = resp["new"]
            const desiredItem = newCategory.find((item) => item.name.includes(config.keyword));
            const itemId = desiredItem.id;
            this.logger.success("Loaded products...")
            await this.Item(itemId)

            
            
        } catch (err) {
            console.log(err);
        }
    }

    async Item(id) {
        const opts = {
            url: `https://www.supremenewyork.com/shop/${id}.json`,
            method: "GET",
            headers: this.headers,
            agentOptions: { secureProtocol: "TLSv1_2_method" },
            gzip: true,
            json: true
        };

        if (this.config.proxies["useProxies"]) opts["proxy"] = this.getProxy();


        try {
            let resp = await request(opts);
            resp = resp.styles;
            const desiredStyle = resp.find((style => style.name.includes(config.color)));
            const styleId = desiredStyle.id;
            const desiredSize = desiredStyle.sizes.find(size => size.name.includes(config.size));
            const sizeId = desiredSize.id;
            await this.ATC(id,styleId,sizeId)
            
            
        } catch (err) {
            console.log(err);
            
        }
    }

    async ATC (id,style,size) {
        let cookiejar = request.jar();
        const opts = {
            url: `https://www.supremenewyork.com/shop/${id}/add.json`,
            method: "POST",
            headers: this.headers,
            agentOptions: { secureProtocol: "TLSv1_2_method" },
            gzip: true,
            json: true,
            form: {
                s: size,
                st: style,
                qty: 1
            },
            jar: cookiejar
        };

        if (this.config.proxies["useProxies"]) opts["proxy"] = this.getProxy();

        
        try {
           const resp = await request(opts);
           this.logger.success("Added to cart")

           
           this.Checkout(cookiejar)
            
        } catch (err) {
            console.log(err);
            
        }
    }

   
    async Checkout (cookie) {
        const opts = {
            url: `https://www.supremenewyork.com/checkout`,
            method: "POST",
            headers: this.headers,
            agentOptions: { secureProtocol: "TLSv1_2_method" },
            gzip: true,
            json: true,
            form:config.profile,
            jar: cookie
        };

        if (this.config.proxies["useProxies"]) opts["proxy"] = this.getProxy();


        try {
            const resp = await request(opts);
            
            if (resp.status == "failed") {
                for (const error in resp.errors) {
                    this.logger.fatal(`Checkout failed, reason : ${resp.errors[error]}`)
                }
            } else if (resp.status == "paid") {
                this.logger.success("Successfully Checked Out")
            }
            
            
        } catch (err) {

        }
    }

    getProxy() {
        if (!this.config.proxies["useProxies"]) return null;
    
        if (!this.proxies) {
          this.proxies = fs
            .readFileSync(this.config.proxies["proxyFile"], "utf8")
            .split(newLine);
        }
    
        return this.formatProxy(this.proxies[Math.floor(Math.random() * this.proxies.length)])
    }
    
    formatProxy(proxy) {
        if (proxy && ["localhost", ""].indexOf(proxy) < 0) {
          proxy = proxy.replace(" ", "_");
          const proxySplit = proxy.split(":");
          if (proxySplit.length > 3) {
            return (
                "http://" +
                proxySplit[2] +
                ":" +
                proxySplit[3] +
                "@" +
                proxySplit[0] +
                ":" +
                proxySplit[1]
            );
            } else {
                return "http://" + proxySplit[0] + ":" + proxySplit[1];
            } 

        } else { 
            return undefined;
        }
    }


    async checkWeek() {
        const opts = {
          url: "https://www.supremenewyork.com/shop.json",
          method: "GET",
          headers: this.headers,
          agentOptions: { secureProtocol: "TLSv1_2_method" },
          gzip: true,
          json: true
        };
    
        if (this.config.proxies["useProxies"]) opts["proxy"] = this.getProxy();
    
        try {
          let resp = await request(opts);
          let week = resp["release_week"];
    
          if (!this.releaseWeek) {
            this.releaseWeek = week;
            this.logger.info(`Loaded week: ${this.releaseWeek}`);
            return false;
          } else {
            if (this.releaseWeek != week) {
              return true;
            } else {
              return false;
            }
          }
        } catch (err) {
          this.logger.fatal(`Error checking week: ${err.message}`);
          await this.sleep(this.config.errorDelay);
          return await this.checkWeek();
        }
    }


    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }



}


(() => {
    console.log(`
           
░██████╗██╗░░░██╗██████╗░██████╗░███████╗███╗░░░███╗███████╗
██╔════╝██║░░░██║██╔══██╗██╔══██╗██╔════╝████╗░████║██╔════╝
╚█████╗░██║░░░██║██████╔╝██████╔╝█████╗░░██╔████╔██║█████╗░░
░╚═══██╗██║░░░██║██╔═══╝░██╔══██╗██╔══╝░░██║╚██╔╝██║██╔══╝░░
██████╔╝╚██████╔╝██║░░░░░██║░░██║███████╗██║░╚═╝░██║███████╗
╚═════╝░░╚═════╝░╚═╝░░░░░╚═╝░░╚═╝╚══════╝╚═╝░░░░░╚═╝╚══════╝                                    
          `);
  
    new Task(config).Start();
  })();
