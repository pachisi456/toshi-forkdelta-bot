# Toshi ForkDelta Bot

This is a bot for [Toshi](https://www.toshi.org/) that utilizes
the API of the decentralized exchange [ForkDelta](https://forkdelta.github.io).
Prices are currently updated every five minutes. Users can chat
with ForkDelta Bot to
* look up prices of tokens traded on ForkDelta
* set price alarms

If you want to add a new feature feel free to make a pull request.
I will happily review and accept it.

## Run ForkDelta Bot locally

First fork and/or clone this repository and make sure
[Docker](https://docs.docker.com/install/) is installed.
Then run

```
cp docker-compose.yml.sample docker-compose.yml
```

Open docker-compose.yml in your favourite editor and provide a
``TOKEN_APP_SEED`` (generate one [here](https://www.toshi.org/toshi-seed-generator/))
as well as a ``TOKEN_APP_USERNAME``.

You can then run the project locally with

```
docker-compose up
```

If any new depencies are added you can rebuild the project with

```
docker-compose build
```

To start chatting with the ForkDelta Bot running locally on your
machine download Toshi Dev for [Android](https://developers.toshi.org/docs/android)
or [iOS](https://developers.toshi.org/docs/ios)


## See also

* [Toshi](https://www.toshi.org)
* [Toshi Documentation](https://developers.toshi.org/docs)
* [ForkDelta](https://forkdelta.github.io)