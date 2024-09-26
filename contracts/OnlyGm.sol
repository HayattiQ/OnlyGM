// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract OnlyGm is ERC1155, AccessControl, Ownable {
    using Strings for uint256;

    bytes32 public constant ADMIN = "ADMIN";
    bytes private constant INITIAL_DATA = "0x00";

    string public name = "gm";
    string public symbol = "OGM";
    string public title;
    string public description;
    string public svgImage;

    address public treasury;
    uint256 public basisPointFeeMint;
    uint256 public basisPointFeeBurn;

    mapping(uint256 => string) public tokenIdToWord;
    mapping(uint256 => uint256) public totalMinted;
    mapping(uint256 => uint256) public totalBurned;

    event TokenMinted(address indexed _minter, uint256 indexed _tokenId, uint256 _amount);
    event TokenBurned(address indexed _burner, uint256 indexed _tokenId, uint256 _amount);
    event TokenTransferred(address indexed _from, address indexed _to, uint256 indexed _tokenId, uint256 _amount);

    constructor() ERC1155("") Ownable(msg.sender) {
        _grantRole(ADMIN, msg.sender);
    }

    function mint(uint256 _tokenId, uint256 _amount) external payable {
        uint256 _cost = getMintCost(_tokenId, _amount);
        require(bytes(tokenIdToWord[_tokenId]).length != 0, "Word is not set");
        require(msg.value >= _cost, "Not enough ETH");

        uint256 _fee = (_cost * basisPointFeeMint) / 10000;
        payable(treasury).transfer(_fee);

        _mint(msg.sender, _tokenId, _amount, INITIAL_DATA);
        totalMinted[_tokenId] += _amount;
        emit TokenMinted(msg.sender, _tokenId, _amount);
    }

    function burn(uint256 _tokenId) external {
        uint256 _amount = 1;
        require(balanceOf(msg.sender, _tokenId) >= _amount, "Not enough tokens to burn");

        uint256 _withdrawValue = getBurnWithdrawValue(_tokenId);
        uint256 _burnFee = (_withdrawValue * basisPointFeeBurn) / 10000;
        payable(treasury).transfer(_burnFee);
        payable(msg.sender).transfer(_withdrawValue - _burnFee);

        _burn(msg.sender, _tokenId, _amount);
        totalBurned[_tokenId] += _amount;

        emit TokenBurned(msg.sender, _tokenId, _amount);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) public virtual override {
        super.safeTransferFrom(from, to, id, amount, data);
        emit TokenTransferred(from, to, id, amount);
    }

    // Getter
    function totalSupply(uint256 _tokenId) public view returns (uint256) {
        return totalMinted[_tokenId] - totalBurned[_tokenId];
    }
    function uri(uint256) public view virtual override returns (string memory) {
        string memory json = Base64.encode(bytes(string(
            abi.encodePacked(
                '{"name": "',
                title,
                '", "description": "',
                description,
                '", "image": "data:image/svg+xml;base64,',
                Base64.encode(bytes(svgImage)),
                '"}'
            )
        )));
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    function getMintCost(uint256 _tokenId, uint256 _amount) public view returns (uint256) {
        uint256 _supply = totalSupply(_tokenId);
        uint256 _cost = 0;
        for (uint256 i = 0; i < _amount; i++) {
            _cost += calculateCost(_supply + i);
        }
        return _cost;
    }
    function getBurnWithdrawValue(uint256 _tokenId) public view returns (uint256) {
        uint256 _mintCost = calculateCost(totalSupply(_tokenId) - 1);
        uint256 _mintFee = (_mintCost * basisPointFeeMint) / 10000;
        return _mintCost - _mintFee;
    }
    function calculateCost(uint256 _amount) public pure returns (uint256) {
        return 0.0001 ether + (_amount * 0.00001 ether);
    }

    // Setter
    function setTokenIdToWord(uint256 _tokenId, string memory _value) external onlyRole(ADMIN) {
        tokenIdToWord[_tokenId] = _value;
    }
    function setTreasury(address _value) external onlyRole(ADMIN) {
        treasury = _value;
    }
    function setBasisPointFeeMint(uint256 _value) external onlyRole(ADMIN) {
        basisPointFeeMint = _value;
    }
    function setBasisPointFeeBurn(uint256 _value) external onlyRole(ADMIN) {
        basisPointFeeBurn = _value;
    }
    function setTitle(string memory _value) external onlyRole(ADMIN) {
        title = _value;
    }
    function setDescription(string memory _value) external onlyRole(ADMIN) {
        description = _value;
    }
    function setSvgImage(string memory _value) external onlyRole(ADMIN) {
        svgImage = _value;
    }

    // AccessControl
    function grantRole(bytes32 role, address account) public override onlyOwner {
        _grantRole(role, account);
    }
    function revokeRole(bytes32 role, address account) public override onlyOwner {
        _revokeRole(role, account);
    }

    // interface
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return
            ERC1155.supportsInterface(interfaceId) ||
            AccessControl.supportsInterface(interfaceId);
    }
}