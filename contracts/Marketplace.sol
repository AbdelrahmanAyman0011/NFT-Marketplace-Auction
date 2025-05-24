// SPDX-License-Identifier: MIT
// Specifies the license under which this contract is shared

pragma solidity ^0.8.9;
// Specifies the version of Solidity compiler

import "./ERC20.sol";
// Import custom ERC20 token contract

import "./NFTCollection.sol";
// Import custom ERC721 NFT collection contract

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
// Import OpenZeppelin interface to handle receiving ERC721 tokens

contract Marketplace is IERC721Receiver {
    // Declares the Marketplace contract implementing the IERC721Receiver interface

    string public name;
    // Name of the marketplace

    uint256 public index = 0;
    // Index used to keep track of the number of auctions

    struct Auction {
        // Structure representing a single auction
        uint256 index; // Unique ID of the auction
        address addressNFTCollection; // Address of the NFT collection contract
        address addressPaymentToken; // Address of the ERC20 token contract used for payment
        uint256 nftId; // ID of the NFT being auctioned
        address creator; // Address of the auction creator
        address payable currentBidOwner; // Address of the current highest bidder
        uint256 currentBidPrice; // Current highest bid
        uint256 endAuction; // Timestamp marking the end of the auction
        uint256 bidCount; // Number of bids received
    }

    Auction[] private allAuctions;
    // Array storing all auctions

    event NewAuction(
        // Event emitted when a new auction is created
        uint256 index,
        address addressNFTCollection,
        address addressPaymentToken,
        uint256 nftId,
        address mintedBy,
        address currentBidOwner,
        uint256 currentBidPrice,
        uint256 endAuction,
        uint256 bidCount
    );

    event NewBidOnAuction(uint256 auctionIndex, uint256 newBid);
    // Event emitted when a new bid is placed

    event NFTClaimed(uint256 auctionIndex, uint256 nftId, address claimedBy);
    // Event emitted when the winner claims the NFT

    event TokensClaimed(uint256 auctionIndex, uint256 nftId, address claimedBy);
    // Event emitted when the creator claims the payment tokens

    event NFTRefunded(uint256 auctionIndex, uint256 nftId, address claimedBy);
    // Event emitted when the NFT is refunded to the creator (no bids)

    constructor(string memory _name) {
        // Constructor to initialize the marketplace with a name
        name = _name;
    }

    function isContract(address _addr) private view returns (bool) {
        // Internal helper function to check if an address is a contract
        uint256 size;
        assembly {
            size := extcodesize(_addr)
        }
        return size > 0;
    }

    function createAuction(
        // Function to create a new auction
        address _addressNFTCollection,
        address _addressPaymentToken,
        uint256 _nftId,
        uint256 _initialBid,
        uint256 _endAuction
    ) external returns (uint256) {
        require(
            isContract(_addressNFTCollection),
            "Invalid NFT Collection contract address"
        );
        // Ensure the NFT collection address is a valid contract

        require(
            isContract(_addressPaymentToken),
            "Invalid Payment Token contract address"
        );
        // Ensure the payment token address is a valid contract

        require(_endAuction > block.timestamp, "Invalid end date for auction");
        // Auction end time must be in the future

        require(_initialBid > 0, "Invalid initial bid price");
        // Initial bid must be greater than zero

        NFTCollection nftCollection = NFTCollection(_addressNFTCollection);
        // Create instance of the NFT collection contract

        require(
            nftCollection.ownerOf(_nftId) == msg.sender,
            "Caller is not the owner of the NFT"
        );
        // Ensure caller owns the NFT

        require(
            nftCollection.getApproved(_nftId) == address(this),
            "Require NFT ownership transfer approval"
        );
        // Ensure this contract is approved to transfer the NFT

        require(
            nftCollection.transferNFTFrom(msg.sender, address(this), _nftId)
        );
        // Transfer NFT from owner to marketplace (lock it)

        address payable currentBidOwner = payable(address(0));
        // Initialize highest bidder address to zero

        Auction memory newAuction = Auction({
            // Create a new Auction object
            index: index,
            addressNFTCollection: _addressNFTCollection,
            addressPaymentToken: _addressPaymentToken,
            nftId: _nftId,
            creator: msg.sender,
            currentBidOwner: currentBidOwner,
            currentBidPrice: _initialBid,
            endAuction: _endAuction,
            bidCount: 0
        });

        allAuctions.push(newAuction);
        // Add new auction to the list

        index++;
        // Increment auction index for next auction

        emit NewAuction(
            index,
            _addressNFTCollection,
            _addressPaymentToken,
            _nftId,
            msg.sender,
            currentBidOwner,
            _initialBid,
            _endAuction,
            0
        );
        // Emit event to notify new auction creation

        return index;
        // Return new auction index
    }

    function isOpen(uint256 _auctionIndex) public view returns (bool) {
        // Check whether the auction is still open
        Auction storage auction = allAuctions[_auctionIndex];
        if (block.timestamp >= auction.endAuction) return false;
        return true;
    }

    function getCurrentBidOwner(
        uint256 _auctionIndex
    ) public view returns (address) {
        // Returns the address of the current highest bidder
        require(_auctionIndex < allAuctions.length, "Invalid auction index");
        return allAuctions[_auctionIndex].currentBidOwner;
    }

    function getCurrentBid(
        uint256 _auctionIndex
    ) public view returns (uint256) {
        // Returns the current highest bid price
        require(_auctionIndex < allAuctions.length, "Invalid auction index");
        return allAuctions[_auctionIndex].currentBidPrice;
    }

    function bid(
        uint256 _auctionIndex,
        uint256 _newBid
    ) external returns (bool) {
        // Place a new bid on an auction
        require(_auctionIndex < allAuctions.length, "Invalid auction index");
        Auction storage auction = allAuctions[_auctionIndex];

        require(isOpen(_auctionIndex), "Auction is not open");
        // Ensure auction is open

        require(
            _newBid > auction.currentBidPrice,
            "New bid price must be higher than the current bid"
        );
        // New bid must be higher than the current one

        require(
            msg.sender != auction.creator,
            "Creator of the auction cannot place new bid"
        );
        // Auction creator cannot place a bid

        ERC20 paymentToken = ERC20(auction.addressPaymentToken);
        // Load payment token contract

        require(
            paymentToken.transferFrom(msg.sender, address(this), _newBid),
            "Tranfer of token failed"
        );
        // Transfer bid tokens to marketplace (lock funds)

        if (auction.bidCount > 0) {
            paymentToken.transfer(
                auction.currentBidOwner,
                auction.currentBidPrice
            );
        }
        // Refund previous highest bidder if applicable

        address payable newBidOwner = payable(msg.sender);
        // Convert bidder address to payable

        auction.currentBidOwner = newBidOwner;
        auction.currentBidPrice = _newBid;
        auction.bidCount++;
        // Update auction data

        emit NewBidOnAuction(_auctionIndex, _newBid);
        // Emit event for new bid

        return true;
    }

    function claimNFT(uint256 _auctionIndex) external {
        // Called by auction winner to claim the NFT
        require(_auctionIndex < allAuctions.length, "Invalid auction index");
        require(!isOpen(_auctionIndex), "Auction is still open");

        Auction storage auction = allAuctions[_auctionIndex];

        require(
            auction.currentBidOwner == msg.sender,
            "NFT can be claimed only by the current bid owner"
        );
        // Only highest bidder can claim the NFT

        NFTCollection nftCollection = NFTCollection(
            auction.addressNFTCollection
        );

        require(
            nftCollection.transferNFTFrom(
                address(this),
                auction.currentBidOwner,
                _auctionIndex
            )
        );
        // Transfer the NFT to the winner

        ERC20 paymentToken = ERC20(auction.addressPaymentToken);
        require(
            paymentToken.transfer(auction.creator, auction.currentBidPrice)
        );
        // Transfer bid funds to auction creator

        emit NFTClaimed(_auctionIndex, auction.nftId, msg.sender);
    }

    function claimToken(uint256 _auctionIndex) external {
        // Called by creator to claim tokens (alternative to claimNFT)
        require(_auctionIndex < allAuctions.length, "Invalid auction index");
        require(!isOpen(_auctionIndex), "Auction is still open");

        Auction storage auction = allAuctions[_auctionIndex];

        require(
            auction.creator == msg.sender,
            "Tokens can be claimed only by the creator of the auction"
        );

        NFTCollection nftCollection = NFTCollection(
            auction.addressNFTCollection
        );

        nftCollection.transferFrom(
            address(this),
            auction.currentBidOwner,
            auction.nftId
        );
        // Transfer NFT to winner

        ERC20 paymentToken = ERC20(auction.addressPaymentToken);
        paymentToken.transfer(auction.creator, auction.currentBidPrice);
        // Transfer funds to creator

        emit TokensClaimed(_auctionIndex, auction.nftId, msg.sender);
    }

    function refund(uint256 _auctionIndex) external {
        // Refund NFT to creator if no bids were placed
        require(_auctionIndex < allAuctions.length, "Invalid auction index");
        require(!isOpen(_auctionIndex), "Auction is still open");

        Auction storage auction = allAuctions[_auctionIndex];

        require(
            auction.creator == msg.sender,
            "Tokens can be claimed only by the creator of the auction"
        );

        require(
            auction.currentBidOwner == address(0),
            "Existing bider for this auction"
        );
        // Only refund if no bids were placed

        NFTCollection nftCollection = NFTCollection(
            auction.addressNFTCollection
        );

        nftCollection.transferFrom(
            address(this),
            auction.creator,
            auction.nftId
        );
        // Transfer NFT back to creator

        emit NFTRefunded(_auctionIndex, auction.nftId, msg.sender);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        // Required function to accept ERC721 tokens
        return this.onERC721Received.selector;
    }
}
