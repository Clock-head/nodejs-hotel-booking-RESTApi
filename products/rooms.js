

class Rooms {
    constructor (capacity, roomNo, price) {
        this.capacity = capacity
        this.roomNo = roomNo
        this.price = price

    }
    static deluxe (capacity, roomNo, price ) {
        return new Rooms(capacity, roomNo, price)
    }

    static superior (capacity, roomNo, price) {
        return new Rooms(capacity, roomNo, price)
    }

    static family(capacity, roomNo, price) {
        return new Rooms(capacity, roomNo, price)
    }
}

module.exports = Rooms