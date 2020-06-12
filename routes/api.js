/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var mongodb = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var fetchJson = require('fetch-json');
var async = require('async');

module.exports = function (app) {

  mongoose.connect(process.env.DATABASE, { useNewUrlParser: true, useUnifiedTopology: true });
  const StockSchema = new Schema({ stock: String, likes: Number, addresses: [String] });
  const STOCK = mongoose.model("STOCK", StockSchema);

  const urlStart = 'https://repeated-alpaca.glitch.me/v1/stock/';
  const urlEnd = '/quote';

  //I can GET /api/stock-prices with form data containing a Nasdaq stock ticker and recieve back an object stockData.
  //In stockData, I can see the stock(string, the ticker), price(decimal in string format), and likes(int).
  app.route('/api/stock-prices')
    .get(function (req, res) {
      let stocks = req.query.stock;
      let like = req.query.like;
      let stockData = [];
      let stocksToObtain = 1;
      let stocksObtained = 0;
      const handleData = (data) => {
        stockData.push({symbol: data.symbol, price: data.latestPrice});
        stocksObtained++;
        if(stocksObtained >= stocksToObtain) {
          handleStockRequest(stockData, like, req.ip, res);
        }
      };
      if (Array.isArray(stocks)) {
        stocksToObtain = stocks.length;
        for (let i = 0; i < stocks.length; i++) {
          fetchJson.get(urlStart + stocks[i] + urlEnd).then(handleData);
        }
      } else {
        fetchJson.get(urlStart + stocks + urlEnd).then(handleData);
      }
    });

  app.route('/api/reset/').get(function(req, res) {
    STOCK.deleteMany({}, function(err, data) {
      if(err) {
        console.log(err);
      } else {
        res.send("Stock data deleted");
      }
    })
  })

  function handleStockRequest(stockData, like, ip, res) {
    let calls = [];
    for(let i = 0; i < stockData.length; i++) {
      calls.push(function(callback) {
        STOCK.findOne({stock: stockData[i].symbol}, function(err, data) {
          if(err) {
            console.log(err);
          } else {
            if(data == null) {
              data = new STOCK({stock: stockData[i].symbol, likes: 0, addresses: []});
            }
            if(like === "true") {
              if(!data.addresses.includes(ip)){
                data.likes++;
              }
              data.addresses.push(ip);
            }
            data.save((err) => {
              if(err) {
                console.log(err);
              }
            });
            callback(null, {stock: data.stock, price: stockData[i].price, likes: data.likes});
          }
        });
      })
    }
    async.parallel(calls, function(err, result) {
      if(err) {
        console.log(err);
      } else {
        if(result.length == 1) {
          result = result[0];
        } else {
          let likeA = result[0].likes;
          let likeB = result[1].likes;
          delete result[0].likes;
          result[0].rel_likes = likeA - likeB;
          delete result[1].likes;
          result[1].rel_likes = likeB - likeA;
        }
        return res.json({"stockData": result});
      }
    })
  }
};